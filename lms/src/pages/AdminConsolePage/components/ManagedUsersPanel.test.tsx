import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { ManagedUsersPanel } from "./ManagedUsersPanel";

afterEach(async () => {
  await act(async () => {
    await i18n.changeLanguage("en");
  });
});

describe("system directory locale changes", () => {
  it("keeps the search and open creation draft while switching locales", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={client}>
        <ManagedUsersPanel
          users={[
            {
              id: 1,
              tenantId: 2,
              name: "Maya Chen",
              email: "maya@example.test",
              role: "USER",
              level: "STUDENT",
              status: "ACTIVE",
            },
          ]}
          loading={false}
          error={null}
          onRetry={() => undefined}
        />
      </QueryClientProvider>,
    );
    await user.type(
      screen.getByRole("searchbox", { name: "Search users" }),
      "Maya",
    );
    await user.click(screen.getByRole("button", { name: "Create user" }));
    await user.type(
      screen.getByLabelText("First name", { exact: true }),
      "Alice",
    );
    await act(async () => {
      await i18n.changeLanguage("zh-CN");
    });
    expect(
      screen.getByRole("dialog", { name: "创建受管理账户" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "搜索人员" })).toHaveValue(
      "Maya",
    );
    expect(screen.getByDisplayValue("Alice")).toBeInTheDocument();
    expect(screen.queryByText("Create managed user")).not.toBeInTheDocument();
    await act(async () => {
      await i18n.changeLanguage("zh-TW");
    });
    expect(
      screen.getByRole("dialog", { name: "建立受管理帳戶" }),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Alice")).toBeInTheDocument();
  });
});
