import { logoutAction } from "@/app/(auth)/actions";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button className="quest-button quest-button-secondary w-full" type="submit">
        Log Out
      </button>
    </form>
  );
}
