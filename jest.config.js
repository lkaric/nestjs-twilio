module.exports = {
  preset: 'ts-jest',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  globals: {
    'ts-jest': {
      tsConfig: './tsconfig.test.json',
    },
  },
  testRegex: '.test.ts$',
  collectCoverageFrom: ['lib/**/*.*.ts'],
  setupFiles: ['./jest.setup.js'],
  testEnvironment: 'node',
};
