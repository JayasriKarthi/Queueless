import { z } from 'zod';

// validate({ body, params, query }) checks each request part against a Zod schema.
// Express 5: req.query is read-only, so the parsed query goes on req.validatedQuery.
// req.body and req.params are replaced with their parsed values.
// All problems are reported together, and error.middleware turns them into a 400 response.
export const validate = ({ body, params, query } = {}) => async (req, res, next) => {
  const issues = [];

  // parseAsync-style checks, so schemas can use async rules (for example "is this slug free?").
  const check = async (schema, value, prefix) => {
    const result = await schema.safeParseAsync(value);
    if (result.success) return result.data;
    // Body fields keep their own names so forms can show messages next to inputs;
    // params and query fields are prefixed so it is clear where the problem is.
    issues.push(...result.error.issues.map((issue) => ({ ...issue, path: prefix ? [prefix, ...issue.path] : issue.path })));
    return undefined;
  };

  const parsedParams = params && (await check(params, req.params, 'params'));
  const parsedQuery = query && (await check(query, req.query, 'query'));
  // Express 5 leaves req.body undefined when a request has no body.
  const parsedBody = body && (await check(body, req.body ?? {}));

  if (issues.length) throw new z.ZodError(issues);

  if (params) req.params = parsedParams;
  if (query) req.validatedQuery = parsedQuery;
  if (body) req.body = parsedBody;
  next();
};

export default validate;
