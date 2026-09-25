import { expect, test, type Page } from "@playwright/test";
import { resetIsolatedE2EFixtures } from "./lab3-server-helper.js";

const INITIAL_PASSWORD=process.env.LAB_SEED_INITIAL_PASSWORD??"local-lab-only-seed-password-2026";
const NEW_INITIAL_PASSWORD=`${INITIAL_PASSWORD}-admin-reset`;
async function loginAdmin(page:Page){await page.goto("/");await page.getByLabel("Email").fill("e2e.admin@example.test");await page.getByRole("textbox",{name:"Password",exact:true}).fill(INITIAL_PASSWORD);await page.getByRole("button",{name:"Sign In",exact:true}).click();await expect(page.getByRole("heading",{name:"User Management",exact:true})).toBeVisible();}

test.describe("E2E-04 Administrator User Management",()=>{
  test.beforeEach(()=>resetIsolatedE2EFixtures());
  test("search -> create -> edit activation -> reset initial password",async({page})=>{
    await loginAdmin(page);await page.getByLabel("Search name or email").fill("E2E Staff");await expect(page.getByText("e2e.staff@example.test",{exact:true}).first()).toBeVisible();await page.getByLabel("Search name or email").fill("");
    await page.getByRole("button",{name:"Create User",exact:true}).click();const editor=page.getByRole("heading",{name:"Create User",exact:true}).locator("..");await editor.getByLabel("Name").fill("E2E Managed User");await editor.getByLabel("Email").fill("E2E.Managed.User@Example.Test");await editor.getByLabel("Role").selectOption("IT_STAFF");await editor.getByLabel("Initial Password").fill(INITIAL_PASSWORD);await editor.getByRole("button",{name:"Save User",exact:true}).click();await expect(page.getByRole("status")).toContainText("User created");
    await page.getByLabel("Search name or email").fill("e2e.managed.user@example.test");await page.getByRole("button",{name:"Edit E2E Managed User",exact:true}).first().click();await page.getByLabel("Active account").uncheck();await page.getByRole("button",{name:"Save User",exact:true}).click();const activation=page.getByRole("dialog",{name:"Confirm activation change"});await activation.getByRole("button",{name:"Confirm Account Change",exact:true}).click();await expect(page.getByRole("status")).toContainText("User account updated");
    await page.getByRole("button",{name:"Edit E2E Managed User",exact:true}).first().click();await page.getByRole("button",{name:"Set New Initial Password",exact:true}).click();const reset=page.getByRole("dialog",{name:"Set New Initial Password"});await reset.getByLabel("New Initial Password").fill(NEW_INITIAL_PASSWORD);await reset.getByRole("button",{name:"Confirm Password Reset",exact:true}).click();await expect(page.getByRole("status")).toContainText("Initial password reset");
  });
  test("is usable without horizontal clipping at the mobile breakpoint",async({page})=>{await page.setViewportSize({width:390,height:844});await loginAdmin(page);await expect(page.getByRole("button",{name:"Create User",exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);});
});
