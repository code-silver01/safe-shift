fetch("http://localhost:3001/api/repo/analyze", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ repoUrl: "expressjs/express" })
}).then(r => r.text()).then(t => console.log(t)).catch(e => console.error(e));
