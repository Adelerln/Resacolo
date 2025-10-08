import asyncio
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class Agent:
    name: str
    instructions: str
    handoffs: Optional[List["Agent"]] = field(default_factory=list)


@dataclass
class RunResult:
    final_output: str


class Runner:
    @staticmethod
    async def run(agent: Agent, input: str) -> RunResult:
        # Simple triage based on presence of Spanish markers
        text = input.lower()
        is_spanish = any(word in text for word in ["hola", "cómo", "que", "¿", "¡"])
        if agent.handoffs:
            # choose first matching handoff by language
            chosen = None
            for a in agent.handoffs:
                if is_spanish and "Spanish" in a.name:
                    chosen = a
                    break
                if not is_spanish and "English" in a.name:
                    chosen = a
                    break
            if chosen is None:
                chosen = agent.handoffs[0]
            return RunResult(final_output=f"{chosen.name} handled: {input}")
        # default behavior
        return RunResult(final_output=f"{agent.name} handled: {input}")

spanish_agent = Agent(
    name="Spanish agent",
    instructions="You only speak Spanish.",
)

english_agent = Agent(
    name="English agent",
    instructions="You only speak English",
)

triage_agent = Agent(
    name="Triage agent",
    instructions="Handoff to the appropriate agent based on the language of the request.",
    handoffs=[spanish_agent, english_agent],
)


async def main():
    result = await Runner.run(triage_agent, input="Hola, ¿cómo estás?")
    print(result.final_output)


if __name__ == "__main__":
    asyncio.run(main())