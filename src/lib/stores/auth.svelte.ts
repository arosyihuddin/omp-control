class AuthStore {
  username = $state<string | null>(null);

  setUsername(username: string | null | undefined) {
    this.username = username?.trim() || null;
  }

  clear() {
    this.username = null;
  }
}

export const authUser = new AuthStore();
