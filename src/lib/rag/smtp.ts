import net from 'node:net';
import tls from 'node:tls';
import { getRagEnv } from '@/lib/rag/env';

type SocketLike = net.Socket | tls.TLSSocket;

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
};

class SmtpClient {
  private socket: SocketLike | null = null;
  private buffer = '';

  constructor(private readonly host: string, private readonly port: number) {}

  private readResponse(): Promise<{ code: number; lines: string[] }> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('SMTP socket indisponible.'));
        return;
      }

      const lines: string[] = [];
      const onData = (chunk: Buffer | string) => {
        this.buffer += chunk.toString();
        const parts = this.buffer.split(/\r?\n/);
        this.buffer = parts.pop() ?? '';

        for (const line of parts) {
          if (!line) continue;
          lines.push(line);
          if (/^\d{3} /.test(line)) {
            cleanup();
            const code = Number.parseInt(line.slice(0, 3), 10);
            resolve({ code, lines });
            return;
          }
        }
      };

      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };

      const onClose = () => {
        cleanup();
        reject(new Error('Connexion SMTP fermée prématurément.'));
      };

      const cleanup = () => {
        this.socket?.off('data', onData);
        this.socket?.off('error', onError);
        this.socket?.off('close', onClose);
      };

      this.socket.on('data', onData);
      this.socket.on('error', onError);
      this.socket.on('close', onClose);
    });
  }

  private async expect(codes: number[]) {
    const response = await this.readResponse();
    if (!codes.includes(response.code)) {
      throw new Error(`SMTP response inattendue ${response.code}: ${response.lines.join(' | ')}`);
    }
    return response;
  }

  private write(command: string) {
    if (!this.socket) {
      throw new Error('SMTP socket indisponible.');
    }
    this.socket.write(`${command}\r\n`);
  }

  async connect() {
    this.socket =
      this.port === 465
        ? tls.connect({
            host: this.host,
            port: this.port,
            rejectUnauthorized: false
          })
        : net.connect({
            host: this.host,
            port: this.port
          });

    await new Promise<void>((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('SMTP socket indisponible.'));
        return;
      }

      const onReady = () => {
        cleanup();
        resolve();
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      const cleanup = () => {
        this.socket?.off('error', onError);
        this.socket?.off('connect', onReady);
        this.socket?.off('secureConnect', onReady);
      };

      this.socket.on('error', onError);
      if (this.port === 465) {
        this.socket.on('secureConnect', onReady);
      } else {
        this.socket.on('connect', onReady);
      }
    });

    await this.expect([220]);
  }

  async sendCommand(command: string, expectedCodes: number[]) {
    this.write(command);
    return this.expect(expectedCodes);
  }

  async close() {
    if (!this.socket) return;
    try {
      this.write('QUIT');
      await this.expect([221]);
    } catch {
      // ignore close errors
    }
    this.socket.end();
    this.socket.destroy();
    this.socket = null;
  }
}

function escapeForData(value: string) {
  return value
    .replace(/\r?\n/g, '\r\n')
    .replace(/^\./gm, '..');
}

export async function sendEscalationEmail(input: SendEmailInput) {
  const env = getRagEnv();
  if (!env.smtp) {
    throw new Error('SMTP non configuré.');
  }

  const { host, port, user, pass, from } = env.smtp;
  const client = new SmtpClient(host, port);
  const localHost = 'resacolo.local';

  await client.connect();
  try {
    await client.sendCommand(`EHLO ${localHost}`, [250]);
    await client.sendCommand('AUTH LOGIN', [334]);
    await client.sendCommand(Buffer.from(user).toString('base64'), [334]);
    await client.sendCommand(Buffer.from(pass).toString('base64'), [235]);
    await client.sendCommand(`MAIL FROM:<${from}>`, [250]);
    await client.sendCommand(`RCPT TO:<${input.to}>`, [250, 251]);
    await client.sendCommand('DATA', [354]);

    const payload = [
      `From: ${from}`,
      `To: ${input.to}`,
      `Subject: ${input.subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      '',
      input.text
    ].join('\r\n');

    await client.sendCommand(`${escapeForData(payload)}\r\n.`, [250]);
  } finally {
    await client.close();
  }
}
