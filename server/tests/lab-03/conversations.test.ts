import { describe, expect, it } from "vitest";
import {
  projectInternalNoteEntry,
  projectPublicCommentEntry,
  validateConversationBody,
} from "../../src/conversation.js";

describe("Lab 3 conversation helpers", () => {
  it("trims outer whitespace and accepts the 1 and 5,000 JavaScript-unit boundaries", () => {
    expect(validateConversationBody({ content: "  x\n" }).input).toEqual({ content: "x" });
    expect(validateConversationBody({ content: "x".repeat(5000) }).input?.content).toHaveLength(5000);
  });

  it.each([
    [{ content: "" }, "empty"],
    [{ content: " \n\t " }, "whitespace"],
    [{ content: 7 }, "non-string"],
    [{ content: "x".repeat(5001) }, "5,001 units"],
  ])("rejects %s content (%s)", (body, _label) => {
    const result = validateConversationBody(body);
    expect(result.input).toBeUndefined();
    expect(result.fieldErrors.content).toBeDefined();
  });

  it("uses JavaScript string-unit semantics for surrogate pairs", () => {
    expect("😀").toHaveLength(2);
    expect(validateConversationBody({ content: "😀".repeat(2500) }).input?.content).toHaveLength(5000);
    expect(validateConversationBody({ content: "😀".repeat(2500) + "x" }).fieldErrors.content).toBeDefined();
  });

  it("preserves internal spaces/newlines and treats script/HTML/Markdown-looking text as exact data", () => {
    const content = "  <script>alert('x')</script>\n\n**not markdown**   inside  ";
    expect(validateConversationBody({ content }).input).toEqual({
      content: "<script>alert('x')</script>\n\n**not markdown**   inside",
    });
  });

  it("rejects every unknown or backend-owned field", () => {
    const body = {
      content: "valid",
      authorId: 9,
      createdAt: "2026-09-19T00:00:00.000Z",
      visibility: "PUBLIC",
      clientRequestId: "not-supported",
      requesterId: 1,
      surprise: true,
    };
    const result = validateConversationBody(body);
    expect(result.input).toBeUndefined();
    expect(Object.keys(result.fieldErrors).sort()).toEqual([
      "authorId",
      "clientRequestId",
      "createdAt",
      "requesterId",
      "surprise",
      "visibility",
    ]);
  });

  it("requires a JSON object body containing content", () => {
    expect(validateConversationBody(null).fieldErrors.body).toBeDefined();
    expect(validateConversationBody([]).fieldErrors.body).toBeDefined();
    expect(validateConversationBody({}).fieldErrors.content).toBeDefined();
  });

  it("projects the exact safe public Entry without email or internal fields", () => {
    const record = {
      id: 3,
      ticketId: 42,
      content: "public data",
      author: { id: 1, name: "Requester", role: "REQUESTER" as const, email: "private@example.test" },
      createdAt: new Date("2026-09-19T01:02:03.000Z"),
      authorId: 1,
      internalNote: { content: "never expose" },
    };
    expect(projectPublicCommentEntry(record)).toEqual({
      id: 3,
      ticketId: 42,
      content: "public data",
      author: { id: 1, name: "Requester", role: "REQUESTER" },
      createdAt: "2026-09-19T01:02:03.000Z",
    });
  });

  it("uses an independent exact safe Internal Note projection", () => {
    const record = {
      id: 8,
      ticketId: 42,
      content: "private data",
      author: { id: 10, name: "Staff", role: "IT_STAFF" as const, email: "staff@example.test" },
      createdAt: new Date("2026-09-19T02:03:04.000Z"),
      visibility: "INTERNAL",
    };
    expect(projectInternalNoteEntry(record)).toEqual({
      id: 8,
      ticketId: 42,
      content: "private data",
      author: { id: 10, name: "Staff", role: "IT_STAFF" },
      createdAt: "2026-09-19T02:03:04.000Z",
    });
    expect(projectPublicCommentEntry({ ...record, content: "public" }).content).toBe("public");
  });
});
