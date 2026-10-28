// Phase 9 (Step 9.7). Replace each todo with a real test when the queue engine is built.
describe('running a queue', () => {
  test.todo('waiting tokens are ordered by priority, then arrival');
  test.todo('each queue mode sends calls to the right resources');
  test.todo('"any available" tokens can be called by any eligible resource');
  test.todo('two staff calling next at the same moment never call the same customer');
  test.todo('skip moves a token to the end of its line');
  test.todo('invalid status changes return 409');
  test.todo('wait estimates match the formula');
});
