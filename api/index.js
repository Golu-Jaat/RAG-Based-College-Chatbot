import { initializeApp, routeRequest } from "../server/src/app.js";

let ready;

export default async function handler(req, res) {
  ready ||= initializeApp();
  await ready;
  return routeRequest(req, res);
}
