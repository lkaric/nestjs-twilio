module.exports = {
  preset: 'ts-jest',
  transform: {
    '.test.ts$': [
      'ts-jest',
      {
        tsconfig: './tsconfig.test.json',
      },
    ],
  },
  testRegex: '.test.ts$',
  collectCoverageFrom: ['lib/**/*.*.ts'],
  setupFiles: ['./jest.setup.js'],
  testEnvironment: 'node',
};
