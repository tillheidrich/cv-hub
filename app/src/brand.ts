// Configurable app/brand name for the open-source build.
// Override at build time with VITE_APP_NAME; defaults to "CV-Hub".
export const APP_NAME = (import.meta.env.VITE_APP_NAME as string | undefined) || 'CV-Hub';
