import { parseSender, sendViaBrevo } from '../src/services/notification.service.js';

// A stand-in for fetch: records the request and answers with the given status.
const fakeFetch = (status, body = {}) => {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    return { ok: status < 300, status, statusText: 'x', json: async () => body };
  };
  fn.calls = calls;
  return fn;
};

describe('email through Brevo', () => {
  test('reads the sender name and address', () => {
    expect(parseSender('QueueLess <me@example.com>')).toEqual({ name: 'QueueLess', email: 'me@example.com' });
    expect(parseSender('me@example.com')).toEqual({ email: 'me@example.com' });
  });

  test('sends one email to the address given, with the key in a header', async () => {
    const fetch = fakeFetch(201, { messageId: 'abc' });
    await sendViaBrevo({ apiKey: 'test-key', from: 'QueueLess <me@example.com>', to: 'priya@example.com', subject: 'Hi', text: 'Body' }, fetch);
    expect(fetch.calls).toHaveLength(1);
    const { url, init } = fetch.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(init.method).toBe('POST');
    expect(init.headers['api-key']).toBe('test-key');
    expect(JSON.parse(init.body)).toEqual({
      sender: { name: 'QueueLess', email: 'me@example.com' },
      to: [{ email: 'priya@example.com' }],
      subject: 'Hi',
      textContent: 'Body',
    });
  });

  test("a refusal throws with Brevo's message", async () => {
    const fetch = fakeFetch(400, { code: 'invalid_parameter', message: 'Sender is not valid' });
    await expect(sendViaBrevo({ apiKey: 'k', from: 'a@b.com', to: 'c@d.com', subject: 's', text: 't' }, fetch)).rejects.toThrow('Brevo 400: Sender is not valid');
  });
});
