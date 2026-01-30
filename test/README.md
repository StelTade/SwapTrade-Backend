# Testing Guidelines

## Philosophy
We use unit tests to validate business logic in isolation.
All external dependencies (DB, APIs, events) are mocked.

## Tools
- Jest
- jest.mock for dependency isolation

## Patterns
- One test file per service
- Arrange → Act → Assert
- Test both success and failure paths
- Clear mocks before each test

## Coverage
Run:
npm run test -- --coverage

Target:
- Services: >80%
- Focus on critical paths and edge cases
