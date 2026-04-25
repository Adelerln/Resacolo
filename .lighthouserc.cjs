const baseUrl = process.env.LHCI_BASE_URL ?? 'http://localhost:3000';
const stayPath = process.env.LHCI_STAY_PATH ?? '/sejours';

module.exports = {
  ci: {
    collect: {
      numberOfRuns: 3,
      settings: {
        preset: 'mobile',
        throttlingMethod: 'simulate'
      },
      url: [
        `${baseUrl}/`,
        `${baseUrl}/sejours`,
        `${baseUrl}${stayPath}`,
        `${baseUrl}/checkout/informations`
      ]
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.85 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'interaction-to-next-paint': ['error', { maxNumericValue: 200 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }]
      }
    },
    upload: {
      target: 'temporary-public-storage'
    }
  }
};
