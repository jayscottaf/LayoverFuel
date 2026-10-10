import { createServer } from "node:http";

const menuUrl = "https://www.sweetgreen.com/menu";
const locationUrl = "https://www.sweetgreen.com/locations";
const meal = { venue: "Synthetic Test Kitchen", address: "100 Fixture Street, Nashville, TN", name: "Fixture chicken bowl",
  order: "Chicken, rice and vegetables", portion: "One bowl; dressing on the side", calories: 600, protein: 40, carbs: 65, fat: 18,
  menuUrl, locationUrl, access: "" };
const sources = [menuUrl, locationUrl].map(url => ({ type: "url_citation", title: "Synthetic source", url, start_index: 0, end_index: 10 }));
createServer(async (req, res) => {
  const chunks = []; for await (const chunk of req) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks).toString());
  const search = !!body.tools;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ id: "resp_fixture", object: "response", status: "completed", output: [
    ...(search ? [{ id: "search_fixture", type: "web_search_call", status: "completed", action: { type: "search", query: "fixture" } }] : []),
    { id: "msg_fixture", type: "message", role: "assistant", status: "completed", content: [{ type: "output_text",
      text: search ? "Synthetic Test Kitchen offers the fixture chicken bowl at 100 Fixture Street." : JSON.stringify({ meals: [meal] }),
      annotations: search ? sources : [],
    }] },
  ] }));
}).listen(5190, "127.0.0.1", () => console.log("Synthetic OpenAI fixture: http://127.0.0.1:5190"));
