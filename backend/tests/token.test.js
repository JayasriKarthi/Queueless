// Phase 9 (Step 9.7). Replace each todo with a real test when the queue engine is built.
describe('joining a queue', () => {
  test.todo('token numbers increase per prefix and restart each day');
  test.todo('20 joins at the same time get 20 different numbers');
  test.todo('a phone with an active token gets that token back instead of a duplicate');
  test.todo('the daily limit, a closed queue, and a queue that is not live are refused');
  test.todo('priority is ignored on plans without priority queues');
  test.todo("the business's custom join-form fields are validated");
  test.todo('leaving the line needs the guest secret');
});
