import { vi } from "vitest";
import * as api from "../src/api.js";

export const requesterUser: api.AuthUser = {
  id: 1,
  name: "Alice Requester",
  email: "alice@example.test",
  role: "REQUESTER",
  mustChangePassword: false,
};

export const csrfToken = "a".repeat(64);

export function mockCurrentUser(user: api.AuthUser = requesterUser) {
  return vi.spyOn(api, "getCurrentUser").mockResolvedValue({ user, csrfToken });
}

export function setRoute(path = "/") {
  window.history.replaceState({}, "", path);
}
