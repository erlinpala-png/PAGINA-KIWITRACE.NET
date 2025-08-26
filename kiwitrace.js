const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const db = new sqlite3.Database('usuarios.db');

// 1. Crear la tabla si no existe
db.run(`CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario TEXT,
  contrasena TEXT,
  nombre TEXT,
  apellido TEXT,
  telefono TEXT,
  correo TEXT UNIQUE,
  fecha TEXT,
  verificado INTEGER DEFAULT 0,
  token TEXT
)`, (err) => {
  if (err) {
    console.error('Error al crear la tabla:', err);
  } else {
    // 2. Solo aquí inserta datos de ejemplo si quieres
    // Ejemplo:
    /*
    db.run(
      `INSERT INTO usuarios (usuario, contrasena, nombre, apellido, telefono, correo, fecha, verificado, token)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      ['laura', '1234', 'Laura', 'Chiquinquirá', '123456789', 'laura@mail.com', '2023-01-01', 'bGF1cmFAbWFpbC5jb20='],
      function(err) {
        if (err) {
          console.error('Error al insertar datos de ejemplo:', err);
        } else {
          console.log('Usuario de ejemplo insertado');
        }
      }
    );
    */
  }
});

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use('/img', express.static(__dirname + '/img'));

// Configuración del transporter de Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'kiwitrace.net@gmail.com',
    pass: 'asap pqdr utep xtrp'
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Endpoint para el registro de usuarios
app.post('/datos', (req, res) => {
  const { correo, usuario, contrasena, nombre, apellido, telefono, fecha } = req.body;

  db.get('SELECT correo FROM usuarios WHERE correo = ?', [correo], (err, row) => {
    if (row) {
      // Ya existe un usuario con ese correo
      return res.status(409).json({ success: false, mensaje: 'Este correo ya está registrado.' });
    }

    // Genera un token (ejemplo simple)
    const token = Buffer.from(correo).toString('base64');

    // Guarda el usuario en la base de datos (aquí deberías guardar todos los campos)
    db.run(
      `INSERT INTO usuarios (usuario, contrasena, nombre, apellido, telefono, correo, fecha, verificado, token)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [usuario, contrasena, nombre, apellido, telefono, correo, fecha, token],
      function (err) {
        if (err) {
          return res.status(500).json({ success: false, mensaje: 'Error al registrar usuario.' });
        }

        // Envía el correo de confirmación
        const confirmUrl = `http://127.0.0.1:3000/confirmar/${token}`;
        const mailOptions = {
          from: 'kiwitrace.net@gmail.com',
          to: correo,
          subject: 'Confirma tu registro en KiwiTrace',
          html: `
            <h1>Bienvenido a KiwiTrace</h1>
            <p>Gracias por registrarte. Por favor, confirma tu correo electrónico haciendo clic en el siguiente enlace:</p>
            <a href="${confirmUrl}">${confirmUrl}</a>
            <p>-KiwiTrace Team</p>
            <p>Si no te registraste en KiwiTrace, ignora este correo.</p>
          `
          // Elimina el campo attachments temporalmente
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            return res.status(500).json({
              success: false,
              mensaje: 'Error al enviar el correo de confirmación.'
            });
          }
          return res.status(201).json({
            success: true,
            mensaje: 'Registro exitoso. Revisa tu correo para confirmar.'
          });
        });
      }
    );
  });
});

app.get('/confirmar/:token', (req, res) => {
  const token = req.params.token;
  console.log('Token recibido:', token); // <-- LOG
  db.get('SELECT verificado FROM usuarios WHERE token = ?', [token], (err, row) => {
    if (err) {
      console.error('Error en SELECT:', err);
      return res.status(500).send('Error al verificar el correo.');
    }
    if (!row) {
      console.log('Token no encontrado en la base de datos'); // <-- LOG
      return res.status(400).send('Token inválido.');
    }
    if (row.verificado === 1) {
      return res.send('Tu correo ya estaba verificado. ¡Ya puedes iniciar sesión!');
    }
    db.run('UPDATE usuarios SET verificado = 1 WHERE token = ?', [token], function(err) {
      if (err) {
        console.error('Error en UPDATE:', err);
        return res.status(500).send('Error al verificar el correo.');
      }
      res.send(`
        <h2>¡Correo verificado correctamente! Ve a kiwitrace para iniciar sesión.</h2>
        <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/Kiwi_aka.jpg" alt="Verificado" style="width:300px;height:auto;"/>
      `);
    });
  });
});

app.post('/login', (req, res) => {
  const { correo, contrasena } = req.body;
  db.get('SELECT * FROM usuarios WHERE correo = ? AND contrasena = ?', [correo, contrasena], (err, row) => {
    if (err) {
      return res.status(500).json({ success: false, mensaje: 'Error en el servidor.' });
    }
    if (!row) {
      return res.status(401).json({ success: false, mensaje: 'Correo o contraseña incorrectos.' });
    }
    if (row.verificado !== 1) {
      return res.status(403).json({ success: false, mensaje: 'Debes verificar tu correo antes de iniciar sesión.' });
    }
    res.json({ success: true, mensaje: 'Inicio de sesión exitoso.' });
  });
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://127.0.0.1:${PORT}`);
});


// Endpoint para actualizar perfil
app.post('/actualizar-perfil', (req, res) => {
  const { nombre, telefono, correo, contrasena } = req.body;
  if (!correo) {
    return res.status(400).json({ success: false, mensaje: 'Correo requerido para actualizar perfil.' });
  }
  // Validación de contraseña si se envía
  if (contrasena) {
    if (contrasena.length < 8 || contrasena.length > 16) {
      return res.status(400).json({ success: false, mensaje: 'La contraseña debe tener entre 8 y 16 caracteres.' });
    }
    if (!(/[a-zA-Z]/.test(contrasena) && /[0-9]/.test(contrasena) && /[^a-zA-Z0-9]/.test(contrasena))) {
      return res.status(400).json({ success: false, mensaje: 'La contraseña debe contener al menos una letra, un número y un carácter especial.' });
    }
  }
  // Construir query dinámicamente según los campos enviados
  let campos = [];
  let valores = [];
  if (nombre) { campos.push('nombre = ?'); valores.push(nombre); }
  if (telefono) { campos.push('telefono = ?'); valores.push(telefono); }
  if (contrasena) { campos.push('contrasena = ?'); valores.push(contrasena); }
  if (campos.length === 0) {
    return res.status(400).json({ success: false, mensaje: 'No hay datos para actualizar.' });
  }
  const query = `UPDATE usuarios SET ${campos.join(', ')} WHERE correo = ?`;
  valores.push(correo);
  db.run(query, valores, function(err) {
    if (err) {
      return res.status(500).json({ success: false, mensaje: 'Error al actualizar el perfil.' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ success: false, mensaje: 'Usuario no encontrado.' });
    }
    res.json({ success: true, mensaje: 'Perfil actualizado correctamente.' });
  });
});


// Endpoint para cambiar la contraseña
app.post('/cambiar-contrasena', (req, res) => {
  const { correo, telefono, nuevaContrasena } = req.body;
  if (!nuevaContrasena || (!correo && !telefono)) {
    return res.status(400).json({ success: false, mensaje: 'Faltan datos requeridos.' });
  }
  // Validación de contraseña
  if (nuevaContrasena.length < 8 || nuevaContrasena.length > 16) {
    return res.status(400).json({ success: false, mensaje: 'La contraseña debe tener entre 8 y 16 caracteres.' });
  }
  if (!(/[a-zA-Z]/.test(nuevaContrasena) && /[0-9]/.test(nuevaContrasena) && /[^a-zA-Z0-9]/.test(nuevaContrasena))) {
    return res.status(400).json({ success: false, mensaje: 'La contraseña debe contener al menos una letra, un número y un carácter especial.' });
  }
  // Buscar por correo si está, si no por teléfono
  let query = '';
  let param = '';
  if (correo) {
    query = 'UPDATE usuarios SET contrasena = ? WHERE correo = ?';
    param = correo;
  } else {
    query = 'UPDATE usuarios SET contrasena = ? WHERE telefono = ?';
    param = telefono;
  }
  db.run(query, [nuevaContrasena, param], function(err) {
    if (err) {
      return res.status(500).json({ success: false, mensaje: 'Error al actualizar la contraseña.' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ success: false, mensaje: 'Usuario no encontrado.' });
    }
    res.json({ success: true, mensaje: 'Contraseña actualizada correctamente.' });
  });
});

app.get('/datos', (req, res) => {
  res.send('Hola desde el servidor kiwitrace.js');
  
});
