import { Browser, Page } from '@playwright/test';

export default async function globalSetup({ browser }: { browser: Browser }) {
  // This function runs once before all tests
  // You can set up shared state here if needed
}