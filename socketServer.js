/**
 * Servidor de event listeners y emitters.
 */

let io;
let sesionSocket;
// salasInSession guarda un array de todas las conexiones de sockets activas
let salasInSession = [];
let users = [];

//console.log("io: ", io)

const iniciarSesion = (sio, socket) => {
    console.log("Estamos adentro")

    /**
     * configuramos todos los listeners de sockets de eventos.
     */

    // inicializamos variables globales.
    io = sio
    sesionSocket = socket

    // agregamos el a un array que guarda todos los sockets activos.
    salasInSession.push(sesionSocket)
    //console.log("salasInSession: ", salasInSession);

    // Se ejecuta cuando el cliente se desconecta de su sesion de socket.
    sesionSocket.on("disconnect", onDisconnect)

    // Envía un 'new move' a las otras sesiones de socket que estan conectadas en la misma sala.
    sesionSocket.on("agrega figura", addFigura)

    // Envía un 'new move' a las otras sesiones de socket que estan conectadas en la misma sala.
    sesionSocket.on("elimina figura", removeFigura)

    // Envía un 'new move' a las otras sesiones de socket que estan conectadas en la misma sala.
    sesionSocket.on("agregar flecha", addFlecha)

    // Envía un 'new move' a las otras sesiones de socket que estan conectadas en la misma sala.
    sesionSocket.on("eliminar flechas", removeFlechas)

    // Envía un 'new move' a las otras sesiones de socket que estan conectadas en la misma sala.
    sesionSocket.on('elimina ultima flecha', removeLastFlecha)

    
    

    // Envía un 'new move' a las otras sesiones de socket que estan conectadas en la misma sala.
    sesionSocket.on("new move", newMove)

    // Usuario crea una nueva sala de reunion despues de hacer click al identificarse en el Frontend
    sesionSocket.on("createNewSesion", createNewSesion)

    // Usuario se une a la sala de reunion despues de ser dirigido a la URL con '/game/:sesionId'
    sesionSocket.on("userJoinSesion", userJoinsSesion)

    sesionSocket.on('request username', requestUserName)

    sesionSocket.on('recieved userName', recievedUserName)

    /* ****************************************** CHAT ******************************************** */
    let nombre;

    sesionSocket.on("conectado", chat_conectado)
  
    sesionSocket.on("mensaje", chat_mensaje)
  
    // sesion socket.on("disconnect", () => {
    //   io.emit("mensajes", {
    //     servidor: "Servidor",
    //     mensaje: `${nombre} ha abandonado la sala`,
    //   });
    // });



    /************************************************************************************************ */

}


function videoChatBackend() {
    //
    sesionSocket.on("callUser", (data) => {
        io.to(data.userToCall).emit('hey', {signal: data.signalData, from: data.from});
    })

    sesionSocket.on("acceptCall", (data) => {
        io.to(data.to).emit('callAccepted', data.signal);
    })
}



function userJoinsSesion(idData) {
  // informamos que el administrador se ha conectado
  /*    io.to(socket.roomId).emit('user connected', {
        players: rooms[socket.roomId].players,
      });
*/
    console.log("Desde SERVER: Recibimos idData:", idData);
    console.log("Desde SERVER: idData.sesionId: ", idData.sesionId);
    console.log("Desde SERVER: idData.userName: ", idData.userName);
    console.log("Desde SERVER: idData.isAdmin: ", idData.isAdmin);

    /**
     * Une el socket a la sesion con los datos de la sesion
     */
    //console.log("idData.gameID", idData.sesionId)
    // Apunta al objeto socket del participante
    let sock = this
//    console.log("(userJoinsSesion)idData.sesionId: ", idData.sesionId);
    // Buscar al identificador de la Sala en el Socket.IO manager object.
    let room = io.sockets.adapter.rooms[idData.sesionId]
    console.log("Room:", room)

    // Si la sala existe...
    if (room === undefined) {
        this.emit('status' , "La sesion indicada no existe." );
        return
    }
    //Establecemos un limite de 8 participantes
    if (room.length < 8) {
        // agrega el ID del socket id al objeto de datos.
        idData.mySocketId = sock.id;

        // Ingreso a la sala
        sock.join(idData.sesionId);

        console.log("Cantidad de participantes:", room.length)

        if (room.length > 1) {
            io.sockets.in(idData.sesionId).emit('start sesion', idData.userName)
        }

        // Emite un evento notificando que un participante ha ingresado a la sala.
        io.sockets.in(idData.sesionId).emit('userJoinedRoom', idData);

    } else {
        // Si la capacidad esta completa devuelve un mensaje al participante.
        this.emit('status' , "La capacidad de la sesion esta completa." );
    }
}


function createNewSesion(sesionId) {
    //console.log("(SERVER-CreateNewSesion-sesionId)", sesionId);

    // Devuelve la identificacion de la Sesion (sesionId) y el
    // socket ID (mySocketId) del Administrador
    this.emit('createNewSesion', {sesionId: sesionId, mySocketId: this.id});

    // Une al participante a la Sesion y espera por los demas participantes.
    this.join(sesionId)
}


function newMove(move) {
    /**
     * Obtenemos el ID de la sala a la que enviaremos el mensaje.
     * Enviamos el mensaje a todos menos al que realizó el movimiento
     */

    const sesionId = move.sesionId
    //console.log("movimiento enviado desde el servidor:", move)

    io.to(sesionId).emit('movimiento_ajeno', move);
}

function addFigura(agrega) {
    /**
     * Obtenemos el ID de la sala a la que enviaremos el mensaje.
     * Enviamos el mensaje a todos menos al que realizó el movimiento
     */

    const sesionId = agrega.sesionId
    //console.log(" AF movimiento enviado desde el servidor:", agrega)

    io.to(sesionId).emit('agrega_figura_ajeno', agrega);
}


function removeFigura(elimina) {
    /**
     * Obtenemos el ID de la sala a la que enviaremos el mensaje.
     * Enviamos el mensaje a todos menos al que realizó el movimiento
     */

    const sesionId = elimina.sesionId
    //console.log(" AF movimiento enviado desde el servidor:", elimina)

    io.to(sesionId).emit('elimina_figura_ajeno', elimina);
}

function addFlecha(flecha) {
   
    const idFlecha = flecha.idFlecha
    const desdeId = flecha.desdeId
    const hastaId = flecha.hastaId
    const sesionId = flecha.sesionId
    const isMyMove = flecha.isMyMove

   io.to(sesionId).emit('agregar_flecha_ajena', {idFlecha, desdeId, hastaId, isMyMove});
}

function removeFlechas({sesionId}) {
   
   io.to(sesionId).emit('remover_flechas_ajena');
}


function removeLastFlecha({sesionId}) {
    io.to(sesionId).emit('remover_ultima_flecha_ajena');
}

function onDisconnect() {
    let i = salasInSession.indexOf(sesionSocket);
    salasInSession.splice(i, 1);
}


function requestUserName(sesionId) {
    io.to(sesionId).emit('give userName', this.id);
}

function recievedUserName(data) {
    console.log("recievedUserName:", data)
    data.socketId = this.id
    io.to(data.sesionId).emit('get Other UserName', data);
}

/* *************************** FUNCIONES CHAT ************************************** */

function chat_conectado(nomb) {
    const nombre = nomb;
    //socket.broadcast.emit manda el mensaje a todos los clientes excepto al que ha enviado el mensaje
    this.broadcast.emit("mensajes", {
      nombre: nombre,
      mensaje: `${nombre} se ha unido a la sesion`,
    });
  }

function chat_mensaje (nombre, mensaje) {
    //io.emit manda el mensaje a todos los clientes conectados al chat
    io.emit("mensajes", { nombre, mensaje });
  }

/* ********************************************************************************** */  
exports.iniciarSesion = iniciarSesion
