const low = require("lowdb");
const jsonServer = require("json-server");
const { isAuthenticated } = require("./jwt-authenticate");
const {
  loginHandler,
  uploadFileHandler,
  uploadFilesHandler,
  registerHandler,
} = require("./additional_routes");
const { defaultPort, databaseFile } = require("./config.json");
const queryString = require("query-string");

const FileSync = require("lowdb/adapters/FileSync");
const adapter = new FileSync(databaseFile);
const db = low(adapter);

const server = jsonServer.create();
const router = jsonServer.router(db);
const middlewares = jsonServer.defaults();
const port = process.env.PORT || defaultPort;

// Set default middlewares (logger, static, cors and no-cache)
server.use(middlewares);

// Handle POST, PUT and PATCH request
server.use(jsonServer.bodyParser);

// Save createdAt and updatedAt automatically
server.use((req, res, next) => {
  const currentTime = Date.now();

  if (req.method === "POST") {
    req.body.createdAt = currentTime;
    req.body.modifiedAt = currentTime;
  } else if (["PUT", "PATCH"].includes(req.method)) {
    req.body.modifiedAt = currentTime;
  }

  next();
});

// Register request
server.post("/register", (req, res) => {
  registerHandler(db, req, res);
});

// Login in request
server.post("/login", (req, res) => {
  loginHandler(db, req, res);
});

server.get("/ping", (req, res) => {
  res.status(200).jsonp({ message: "Ping success" });
});

// Upload 1 file
server.post("/upload-file", uploadFileHandler);

// Upload multiple files
server.post("/upload-files", uploadFilesHandler);

// Access control
server.use((req, res, next) => {
  if (isAuthenticated(req)) {
    next();
  } else {
    res.sendStatus(401);
  }
});

router.render = (req, res) => {
  // Check GET with pagination
  const headers = res.getHeaders();
  const totalCountHeader = headers["x-total-count"];
  const favoriteData = db.get("favorite").value();

  // custom responses for return totalRows
  if (req.method === "GET" && totalCountHeader) {
    const queryParams = queryString.parse(req._parsedUrl.query);
    const limit = Number.parseInt(queryParams._limit) || 10;
    const totalRows = Number.parseInt(totalCountHeader);
    const result = {
      data: res.locals.data,
      pagination: {
        page: Number.parseInt(queryParams._page) || 1,
        limit: limit,
        totalRows: totalRows,
        totalPages: Math.floor(totalRows / limit),
      },
    };
    return res.jsonp(result);
  }
  if (req.method === "GET" && req.url === "/galleries") {
    const result = {
      favorite: favoriteData,
      categories: res.locals.data,
    };
    return res.jsonp(result);
  }
  res.jsonp(res.locals.data);
};

// Setup others routes
server.use("/api", router);

// Start server
server.listen(port, () => {
  console.log("Server is running on port " + port);
});
