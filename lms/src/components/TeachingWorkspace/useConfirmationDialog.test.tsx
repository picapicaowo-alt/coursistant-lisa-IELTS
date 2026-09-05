import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import i18n, { SUPPORTED_LOCALES } from "@/i18n";
import { useConfirmationDialog } from "./useConfirmationDialog";

afterEach(async () => {
  await act(() => i18n.changeLanguage("en"));
});

it("retains an open confirmation and its payload through all three locales", async () => {
  const result = vi.fn();
  function Harness() {
    const { confirm, dialog } = useConfirmationDialog();
    return (
      <>
        <button
          onClick={() =>
            void confirm({
              titleKey: "assessment:submission.deleteAssignment",
              messageKey: "assessment:submission.deleteConfirm",
              values: { title: "Authored title" },
            }).then(result)
          }
        >
          Trigger
        </button>
        {dialog}
      </>
    );
  }
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Trigger" }));
  const dialog = screen.getByRole("dialog");
  for (const locale of SUPPORTED_LOCALES) {
    await act(() => i18n.changeLanguage(locale));
    expect(
      screen.getByRole("dialog", {
        name: i18n.t("assessment:submission.deleteAssignment"),
      }),
    ).toBe(dialog);
    expect(
      screen.getByText(
        i18n.t("assessment:submission.deleteConfirm", {
          title: "Authored title",
        }),
      ),
    ).toBeInTheDocument();
    expect(result).not.toHaveBeenCalled();
  }
  fireEvent.click(
    screen.getByRole("button", { name: i18n.t("common:actions.confirm") }),
  );
  await act(async () => {});
  expect(result).toHaveBeenCalledExactlyOnceWith(true);
});

it("cancels a pending action when its page unmounts", async () => {
  const result = vi.fn();
  function Harness() {
    const { confirm, dialog } = useConfirmationDialog();
    return (
      <>
        <button
          onClick={() =>
            void confirm({
              titleKey: "assessment:submission.deleteAssignment",
              messageKey: "assessment:submission.deleteConfirm",
              values: { title: "Authored" },
            }).then(result)
          }
        >
          Trigger
        </button>
        {dialog}
      </>
    );
  }
  const { unmount } = render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Trigger" }));
  unmount();
  await act(async () => {});
  expect(result).toHaveBeenCalledExactlyOnceWith(false);
});

it('retranslates nested platform labels without replacing the pending action', async () => {
  const result = vi.fn();
  function Harness() {
    const {confirm, dialog} = useConfirmationDialog('paper-41');
    return <><button onClick={() => void confirm({titleKey: 'common:actions.remove', messageKey: 'exams:authoring.removeFieldConfirm', valueKeys: {field: 'exams:schema.paragraph'}, values: {number: 2}}).then(result)}>Trigger</button>{dialog}</>;
  }
  render(<Harness/>);
  fireEvent.click(screen.getByRole('button', {name: 'Trigger'}));
  const dialog = screen.getByRole('dialog');
  for (const locale of SUPPORTED_LOCALES) {
    await act(() => i18n.changeLanguage(locale));
    expect(screen.getByRole('dialog')).toBe(dialog);
    expect(screen.getByText(i18n.t('exams:authoring.removeFieldConfirm', {field: i18n.t('exams:schema.paragraph'), number: 2}))).toBeInTheDocument();
    expect(result).not.toHaveBeenCalled();
  }
  fireEvent.click(screen.getByRole('button', {name: i18n.t('common:actions.confirm')}));
  await act(async () => {});
  expect(result).toHaveBeenCalledExactlyOnceWith(true);
});

it("cancels a pending confirmation when the record changes without unmounting", async () => {
  const result = vi.fn();
  function Harness({recordId}: {recordId: number}) {
    const {confirm, dialog} = useConfirmationDialog(recordId);
    return <><button onClick={() => void confirm({titleKey: 'common:actions.delete', messageKey: 'assessment:submission.deleteConfirm', values: {title: 'Original record'}}).then(result)}>Trigger</button>{dialog}</>;
  }
  const {rerender} = render(<Harness recordId={1}/>);
  fireEvent.click(screen.getByRole('button', {name: 'Trigger'}));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  rerender(<Harness recordId={2}/>);
  await act(async () => {});
  expect(result).toHaveBeenCalledExactlyOnceWith(false);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
