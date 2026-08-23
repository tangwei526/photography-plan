"use client";

import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error || "验证失败，请稍后重试");
      setSubmitting(false);
      return;
    }
    const requested = new URLSearchParams(window.location.search).get("next") || "/";
    window.location.replace(requested.startsWith("/") && !requested.startsWith("//") ? requested : "/");
  }

  return <main className="loginPage">
    <section className="loginCard">
      <div className="loginMark">焦</div>
      <p className="eyebrow">GLOBAL PHOTO LOCATION ATLAS</p>
      <h1>进入取景簿</h1>
      <p className="loginIntro">拍摄点位、计划与样片仅向授权成员开放。</p>
      <form onSubmit={submit}>
        <label>账号<input autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} placeholder="请输入账号" /></label>
        <label>密码<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="请输入密码" /></label>
        {error && <p className="loginError" role="alert">{error}</p>}
        <button className="primary full" disabled={submitting || !username || !password}>{submitting ? "正在验证…" : "验证并进入"}</button>
      </form>
      <small>登录状态将在当前浏览器中安全保存 30 天。</small>
    </section>
  </main>;
}
