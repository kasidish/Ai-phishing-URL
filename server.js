const express = require("express");
// Use HTML-based analyzer (includes warning page bypass)
const analyze = require("./sandbox/analyzerHTML");

const app = express();
app.use(express.json());
app.use(express.static("public"));

app.post("/analyze", async (req, res) => {
  try {
    if (!req.body.url) {
      return res.status(400).json({ error: "URL is required" });
    }
    console.log(`\nAnalysis request: ${req.body.url}`);
    const result = await analyze(req.body.url);
    res.json(result);
  } catch (error) {
    console.error("Error analyzing URL:", error.message);
    res.status(500).json({ 
      error: error.message || "Internal server error" 
    });
  }
});

app.listen(3000, "0.0.0.0", () => {
  console.log("Sandbox running");
});

