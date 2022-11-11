const mongoose = require("mongoose");
const express = require("express");
const cors = require("cors");
const csv = require("fast-csv");
const fs = require("fs");
const url = "mongodb://localhost:27017/buildtab-forge-dev";

const FakeDataModel = require("./fake.model");
mongoose.connect(url);
const run = async (jobId) => {
  try {
    const db = FakeDataModel;
    const query = {
      isAsset: true,
    };
    const pipelineStages = [
      {
        $match: query,
      },
      {
        $sort: {
          _id: -1,
        },
      },
      // {
      //   $project: {
      //     _id: 1,
      //     project: 1,
      //     name: 1,
      //     evitElmtId: 1,
      //     revitUniqId: 1,
      //     svfParentPath: 1,
      //   },
      // },
    ];

    const total = await db.countDocuments(query);

    const cursor = db
      .aggregate(pipelineStages, {
        batchSize: 1,
        allowDiskUse: true,
      })
      .cursor();

    const csvStream = csv.format({ headers: true });

    const writeStream = fs.createWriteStream(`./myfile_${jobId}.csv`);

    csvStream
      .pipe(writeStream)
      .on("end", () => {
        console.log("DONE");
      })
      .on("error", (err) => console.error(err));

    let count = 0;
    const timer = setInterval(() => {
      const percent = (count / total) * 100;
      console.log(`Progress ${percent}%`);
      if (percent >= 100) {
        clearInterval(timer);
      }
    }, 1000);
    await cursor.eachAsync((doc) => {
      // console.log(doc);
      csvStream.write(doc);
      count = count + 1;
    });
    csvStream.end();
    writeStream.end();
  } catch (e) {
    console.error(e);
  }
};

const timer = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true);
    }, 3000);
  });
};

(() => {
  const app = express();
  app.use(cors());
  app.post("/exports", async (req, res) => {
    const jobId = Date.now();
    run(jobId);
    res.json({
      jobId,
    });
  });
  app.get("/exports/:fileId", (req, res) => {
    const { fileId } = req.params;
    const fileStream = fs.createReadStream(`./myfile_${fileId}.csv`, {});
    fileStream.on("readable", () => {
      let chunk;
      console.log("Stream is readable (new data received in buffer)");
      // Use a loop to make sure we read all currently available data
      while (null !== (chunk = fileStream.read())) {
        console.log(`Read ${chunk.length} bytes of data...`);
      }
    });
    fileStream.on("data", async (chunk) => {
      // await timer();
      console.log(chunk.length);
    });
    fileStream.pipe(res);
  });

  app.get("/exports-chunk", async (req, res) => {
    const count = await FakeDataModel.countDocuments({
      isAsset: true,
    });
    const EST_CHUNK_SIZE = 200;
    const cursor = FakeDataModel.aggregate(
      [
        {
          $match: {
            isAsset: true,
          },
        },
        {
          $sort: {
            _id: -1,
          },
        },
        // {
        //   $limit: 20,
        // },
        {
          $project: {
            _id: 1,
            project: 1,
            name: 1,
            evitElmtId: 1,
            revitUniqId: 1,
            svfParentPath: 1,
          },
        },
      ],
      {
        batchSize: 1,
        allowDiskUse: true,
      }
    ).cursor();
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Length", count * EST_CHUNK_SIZE);

    let chunkCount = 0;
    res.write("[");
    cursor.on("error", (err) => {
      res.status(400).json({
        message: err.message,
      });
    });
    cursor.on("data", (chunk) => {
      const dimension = chunkCount < count - 1 ? "," : "";
      res.write(JSON.stringify(chunk) + dimension);
      chunkCount = chunkCount + 1;
    });
    cursor.on("end", () => {
      res.write("]");
      res.end("", () => {
        console.log("Done");
      });
    });
  });

  app.get("/exports-json", async (req, res) => {
    const cursor = await FakeDataModel.aggregate(
      [
        {
          $match: {
            isAsset: true,
          },
        },
        {
          $sort: {
            _id: -1,
          },
        },
      ],
      {
        batchSize: 1,
        allowDiskUse: true,
      }
    );
    res.json(cursor);
  });

  app.get("/exports-csv", async (req, res) => {
    const count = await FakeDataModel.countDocuments({
      isAsset: true,
    });
    const EST_CHUNK_SIZE = 200;
    const cursor = FakeDataModel.aggregate(
      [
        {
          $match: {
            isAsset: true,
          },
        },
        {
          $sort: {
            _id: -1,
          },
        },
        {
          $project: {
            _id: 1,
            project: 1,
            name: 1,
            evitElmtId: 1,
            revitUniqId: 1,
            svfParentPath: 1,
          },
        },
      ],
      {
        batchSize: 1,
        allowDiskUse: true,
      }
    ).cursor();
    const csvStream = csv.format({ headers: true });

    res.setHeader("Content-Type", "text/csv");
    // res.setHeader("Content-Length", count * EST_CHUNK_SIZE);
    cursor.on("error", (err) => {
      res.status(400).json({
        message: err.message,
      });
    });
    cursor.on("data", (chunk) => {
      // res.write(Buffer.from(JSON.stringify(chunk)));
      csvStream.write(chunk);
    });
    cursor.on("end", () => {
      csvStream.end("", () => {
        console.log("Convert csv done");
      });
    });

    csvStream.pipe(res);
  });

  app.listen(3000, () => console.log("Sever listen port 3000"));
})();
