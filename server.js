require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('express-jwt');
const jwtDecode = require('jwt-decode');
const mongoose = require('mongoose');


const dashboardData = require('./data/dashboard');
const User = require('./data/User');
const InventoryItem = require('./data/InventoryItem');

const { createToken, hashPassword, verifyPassword } = require('./util');


const app = express();

 //Configurar cabeceras y cors
//  app.use((req, res, next) => {
//    res.header('Access-Control-Allow-Origin', '*');
//    res.header('Access-Control-Allow-Headers', 'Authorization, X-API-KEY, Origin, X-Requested-With, Content-Type, Accept, Access-Control-Allow-Request-Method');
//    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
//    res.header('Allow', 'GET, POST, OPTIONS, PUT, DELETE');
//    next();
//  });


// var dominiosHabilitados = ['https://claudiapedrosa.com', 'http://claudiapedrosa.com', 'http://localhost:3000'];
// app.use(cors({
//   origin: function (origin, callback) {
//     if (!origin) return callback(null, true);
 
//     if (dominiosHabilitados.indexOf(origin) === -1) {
//       var msg = `Este sitio ${origin} no tiene permisos de acceso. Solo los dominios especificados tiene permiso para acceder.`;
//       return callback(new Error(msg), false);
//     }
//     return callback(null, true);
//   }
// }));

app.use(cors({
  origin: ['https://claudiapedrosa.com', 'http://localhost:3000'],
  optionsSuccessStatus: 200
}));


const server = require('http').createServer(app);
// const io = require('socket.io').listen(server);

// const io = require('socket.io')(server, {
//   origins: ["http//localhost:3000"]
// });

// const io = require('socket.io')(server, {
//   origins: ['https://claudiapedrosa.com']
// });



const io = require("socket.io")(server, {
  handlePreflightRequest: (req, res) => {
      const headers = {
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Allow-Origin": req.headers.Origin, //or the specific Origin you want to give access to,
          "Access-Control-Allow-Credentials": true
      };
      res.writeHead(200, headers);
      res.end();
  }
});


app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

const servidor = require('./socketServer');

io.on('connection', client => {
    console.log("Socket.id: ", client.id);
    servidor.iniciarSesion(io, client)
})

const PORT = process.env.PORT || 5000

console.log("Server iniciado");
// Settings
//app.set("pkg", pkg);
//app.set("port", PORT);
//app.set("json spaces", 4);


// Welcome Routes
app.get("/", (req, res) => {
  res.json({
    message: "Constelaciones Mini API",
    // name: app.get("pkg").name,
    // version: app.get("pkg").version,
    // description: app.get("pkg").description,
    // author: app.get("pkg").author,
  });
});


app.post('/api/authenticate', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({
      email
    }).lean();

    if (!user) {
      return res.status(403).json({
        message: 'Email o contraseña incorrectos.'
      });
    }

    const passwordValid = await verifyPassword(
      password,
      user.password
    );

    if (passwordValid) {
      const { password, bio, ...rest } = user;
      const userInfo = Object.assign({}, { ...rest });
      const token = createToken(userInfo);

      const decodedToken = jwtDecode(token);
      const expiresAt = decodedToken.exp;

      res.json({
        message: 'Identificación exitosa!',
        token,
        userInfo,
        expiresAt
      });
    } else {
      res.status(403).json({
        message: 'Email o contraseña ingresados incorrectos.'
      });
    }
  } catch (err) {
    console.log(err);
    return res
      .status(400)
      .json({ message: 'ERROR.' });
  }
});


app.post('/api/signup', async (req, res) => {
  try {
    const { email, firstName, lastName } = req.body;
    const hashedPassword = await hashPassword(
      req.body.password
    );
    console.log(firstName);
    console.log(lastName);
    const userData = {
      email: email.toLowerCase(),
      firstName,
      lastName,
      password: hashedPassword,
      role: 'user'
    };
    console.log(userData);
    const existingEmail = await User.findOne({
      email: userData.email
    }).lean();

    if (existingEmail) {
      return res
        .status(400)
        .json({ message: 'Email ya existe' });
    }

    const newUser = new User(userData);
    const savedUser = await newUser.save();

    if (savedUser) {
      const token = createToken(savedUser);
      const decodedToken = jwtDecode(token);
      const expiresAt = decodedToken.exp;

      const {
        firstName,
        lastName,
        email,
        role
      } = savedUser;

      const userInfo = {
        firstName,
        lastName,
        email,
        role
      };

      return res.json({
        message: 'Usuario creado!',
        token,
        userInfo,
        expiresAt
      });
    } else {
      return res.status(400).json({
        message: 'Hubo un error al crear la cuenta'
      });
    }
  } catch (err) {
    return res.status(400).json({
      message: 'Hubo un error al crear la cuenta'
    });
  }
});

const attachUser = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res
      .status(401)
      .json({ message: 'Identificación inválida' });
  }
  const decodedToken = jwtDecode(token.slice(7));

  if (!decodedToken) {
    return res.status(401).json({
      message: 'Hubo un problema autorizando la solicitud'
    });
  } else {
    req.user = decodedToken;
    next();
  }
};

app.use(attachUser);

const requireAuth = jwt({
  secret: process.env.JWT_SECRET,
  audience: 'api.orbit',
  issuer: 'api.orbit'
});

const requireAdmin = (req, res, next) => {
  const { role } = req.user;
  if (role !== 'admin') {
    return res
      .status(401)
      .json({ message: 'No tiene permisos' });
  }
  next();
};

app.get('/api/dashboard-data', requireAuth, (req, res) =>
  res.json(dashboardData)
);

app.patch('/api/user-role', async (req, res) => {
  try {
    const { role } = req.body;
    const allowedRoles = ['user', 'admin'];

    if (!allowedRoles.includes(role)) {
      return res
        .status(400)
        .json({ message: 'Rol no habilitado' });
    }
    await User.findOneAndUpdate(
      { _id: req.user.sub },
      { role }
    );
    res.json({
      message:
        'Rol de Usuario actualizado. Debe loguarse nuevamente para que los cambios tengan efecto.'
    });
  } catch (err) {
    return res.status(400).json({ error: err });
  }
});

// app.get('/api/inventory',requireAuth,requireAdmin,async (req, res) => {
//  try {
//       const user = req.user.sub;
//       const inventoryItems = await InventoryItem.find({
//         user
//       });
//       res.json(inventoryItems);
//     } catch (err) {
//       return res.status(400).json({ error: err });
//     }
//   }
// );

// app.post(
//   '/api/inventory',
//   requireAuth,
//   requireAdmin,
//   async (req, res) => {
//     try {
//       const userId = req.user.sub;
//       const input = Object.assign({}, req.body, {
//         user: userId
//       });
//       const inventoryItem = new InventoryItem(input);
//       await inventoryItem.save();
//       res.status(201).json({
//         message: 'Artículo creado!',
//         inventoryItem
//       });
//     } catch (err) {
//       return res.status(400).json({
//         message: 'Hubo un error creando este ítem del inventario'
//       });
//     }
//   }
// );

// app.delete(
//   '/api/inventory/:id',
//   requireAuth,
//   requireAdmin,
//   async (req, res) => {
//     try {
//       const deletedItem = await InventoryItem.findOneAndDelete(
//         { _id: req.params.id, user: req.user.sub }
//       );
//       res.status(201).json({
//         message: 'Objeto del inventario eliminado!',
//         deletedItem
//       });
//     } catch (err) {
//       return res.status(400).json({
//         message: 'Hubo un problema eliminado este ítem.'
//       });
//     }
//   }
// );

app.get('/api/users', requireAuth, async (req, res) => {
  try {
    const users = await User.find()
      .lean()
      .select('_id firstName lastName avatar bio');

    res.json({
      users
    });
  } catch (err) {
    return res.status(400).json({
      message: 'Hubo un problema intentando obtener los usuarios'
    });
  }
});

app.get('/api/bio', requireAuth, async (req, res) => {
  try {
    const { sub } = req.user;
    const user = await User.findOne({
      _id: sub
    })
      .lean()
      .select('bio');

    res.json({
      bio: user.bio
    });
  } catch (err) {
    return res.status(400).json({
      message: 'Hubo un error actualizando su bio'
    });
  }
});

app.patch('/api/bio', requireAuth, async (req, res) => {
  try {
    const { sub } = req.user;
    const { bio } = req.body;
    const updatedUser = await User.findOneAndUpdate(
      {
        _id: sub
      },
      {
        bio
      },
      {
        new: true
      }
    );

    res.json({
      message: 'Bio actualizada!',
      bio: updatedUser.bio
    });
  } catch (err) {
    return res.status(400).json({
      message: 'Hubo un error actualizando su bio'
    });
  }
});

async function connect() {
  try {
    mongoose.Promise = global.Promise;
    await mongoose.connect(process.env.ATLAS_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useFindAndModify: false
    });
    console.log('Conectado exitosamente a la base de datos');
  } catch (err) {
    console.log('Mongoose error', err);
  }
  // error handling middleware should be loaded after the loading the routes
  // if (app.get('env') === 'development') {
  //   app.use(errorHandler())
  // }
  
  server.listen(PORT, function () {
    console.log('Express server listening on port ' + PORT)
  })
 }

connect();