// Phase 7 (Step 7.5). Replace each todo with a real test when slugs are built.
describe('slugs', () => {
  test.todo('reserved and malformed slugs are rejected');
  test.todo('changing a slug before go live leaves no history');
  test.todo('after go live, the old slug redirects with 308');
  test.todo("a slug in another business's history is unavailable");
  test.todo('an expired redirect makes the slug available again');
});
