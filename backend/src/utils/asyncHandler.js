// Express 5 already sends errors from async handlers to error.middleware, so routes do not
// need wrapping. This pass-through is kept so the folder layout stays complete and any
// wrapped route still works.
export const asyncHandler = (fn) => fn;

export default asyncHandler;
