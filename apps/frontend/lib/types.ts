/**
 * Frontend-backend contract types.
 *
 * The source of truth lives in the `@wedding-moments/shared` workspace package
 * (packages/shared), which the backend also imports. This file re-exports it so
 * existing `@/lib/types` imports keep working.
 */
export * from '@wedding-moments/shared';
