const tf = require("@tensorflow/tfjs");
const fs = require("fs");
const csv = require("csv-parser");
const extract = require("./extractFeatures");

let X = [];
let y = [];

fs.createReadStream("data/url.csv")
  .pipe(csv())
  .on("data", row => {
    X.push(extract(row.url));
    y.push(Number(row.label));
  })
  .on("end", async () => {
    console.log(`📚 Loading ${X.length} training samples...`);
    console.log(`   Safe URLs: ${y.filter(l => l === 0).length}`);
    console.log(`   Phishing URLs: ${y.filter(l => l === 1).length}`);

    if (X.length === 0) {
      throw new Error("Dataset is empty! Check CSV path or format.");
    }

    const xs = tf.tensor2d(X);
    const ys = tf.tensor2d(y, [y.length, 1]);

    const model = tf.sequential();
    model.add(tf.layers.dense({
      inputShape: [7],
      units: 32,
      activation: "relu"
    }));
    model.add(tf.layers.dense({ units: 16, activation: "relu" }));
    model.add(tf.layers.dense({ units: 1, activation: "sigmoid" }));

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: "binaryCrossentropy",
      metrics: ["accuracy"]
    });

    console.log("🚀 Training model (this may take a moment)...");
    await model.fit(xs, ys, {
      epochs: 200,
      batchSize: X.length,
      verbose: 0,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if ((epoch + 1) % 50 === 0 || epoch === 0) {
            console.log(
              `   Epoch ${epoch + 1}/200 - Loss: ${logs.loss.toFixed(4)}, Accuracy: ${(logs.acc * 100).toFixed(1)}%`
            );
          }
        }
      }
    });
    
    // Test the model on training data
    console.log("\n🧪 Testing on training data:");
    const predictions = model.predict(xs);
    const predData = await predictions.data();
    for (let i = 0; i < Math.min(5, X.length); i++) {
      const actual = y[i];
      const predicted = predData[i];
      const riskScore = Math.round(predicted * 100);
      console.log(`   Sample ${i + 1}: Actual=${actual}, Predicted=${riskScore}% (${predicted.toFixed(3)})`);
    }
    predictions.dispose();

    const modelDir = "ml/model";
    if (!fs.existsSync(modelDir)) {
      fs.mkdirSync(modelDir, { recursive: true });
    }

    // save model.json
    const modelJson = model.toJSON();
    fs.writeFileSync(
      `${modelDir}/model.json`,
      JSON.stringify(modelJson)
    );

    // save weights.json
    const weights = await model.getWeights();
    const weightData = weights.map(w => ({
      shape: w.shape,
      data: Array.from(w.dataSync())
    }));

    fs.writeFileSync(
      `${modelDir}/weights.json`,
      JSON.stringify(weightData, null, 2)
    );

    xs.dispose();
    ys.dispose();

    console.log(" Model trained & saved to ml/model/");
  });
