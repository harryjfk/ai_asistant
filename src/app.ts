import "dotenv/config"
import { createBot, createProvider, createFlow, addKeyword, EVENTS } from '@builderbot/bot'
import { MemoryDB } from '@builderbot/bot'
import { BaileysProvider } from '@builderbot/provider-baileys'
import { toAsk, httpInject } from "@builderbot-plugins/openai-assistants"
import { typing } from "./utils/presence"

/** Puerto en el que se ejecutará el servidor */
const PORT = process.env.PORT ?? 3008
/** ID del asistente de OpenAI */
const ASSISTANT_ID = process.env.ASSISTANT_ID ?? ''
const userQueues = new Map();
const userLocks = new Map(); // New lock mechanism

// const apiUrl  = '';
/**
 * Function to process the user's message by sending it to the OpenAI API
 * and sending the response back to the user.
 */
const processUserMessage = async (ctx, { flowDynamic, state, provider }) => {
    await typing(ctx, provider);
    const response = await toAsk(ASSISTANT_ID, ctx.body, state);

    // Split the response into chunks and send them sequentially
    const chunks = response.split(/\n\n+/);
    for (const chunk of chunks) {
        const cleanedChunk = chunk.trim().replace(/【.*?】[ ] /g, "");
        await flowDynamic([{ body: cleanedChunk }]);
    }
};

/**
 * Function to handle the queue for each user.
 */
const handleQueue = async (userId) => {
    const queue = userQueues.get(userId);
    
    if (userLocks.get(userId)) {
        return; // If locked, skip processing
    }

    while (queue.length > 0) {
        userLocks.set(userId, true); // Lock the queue
        const { ctx, flowDynamic, state, provider } = queue.shift();
        try {
            await processUserMessage(ctx, { flowDynamic, state, provider });
        } catch (error) {
            console.error(`Error processing message for user ${userId}:`, error);
        } finally {
            userLocks.set(userId, false); // Release the lock
        }
    }

    userLocks.delete(userId); // Remove the lock once all messages are processed
    userQueues.delete(userId); // Remove the queue once all messages are processed
};

/**
 * Flujo de bienvenida que maneja las respuestas del asistente de IA
 * @type {import('@builderbot/bot').Flow<BaileysProvider, MemoryDB>}
 */
const welcomeFlow = addKeyword<BaileysProvider, MemoryDB>(EVENTS.WELCOME)
    .addAction(async (ctx, { flowDynamic, state, provider }) => {
        const userId = ctx.from; // Use the user's ID to create a unique queue for each user

        if (!userQueues.has(userId)) {
            userQueues.set(userId, []);
        }

        const queue = userQueues.get(userId);
        queue.push({ ctx, flowDynamic, state, provider });

        // If this is the only message in the queue, process it immediately
        if (!userLocks.get(userId) && queue.length === 1) {
            await handleQueue(userId);
        }
    });
const disponibilidadFlow = addKeyword<BaileysProvider,MemoryDB>('buscar').
    addAction(async (ctx, { flowDynamic }) => {
    const query = ctx.body.toLowerCase().replace('buscar', '').trim(); // Ej: "buscar 1984"

    if(query=="")
    {
        await flowDynamic([{body:'📚 Por favor introduzca correctamente el nombre del libro',}])
        return ;
    }


    const resultados = [];

    if (resultados.length === 0) {
        await flowDynamic([{
            body: '❌ No encontré libros con ese nombre. Prueba con otro término.'
        }]);
        return;
    }
    // const { fecha, personas } = ctx.params;
    //
    // // Llama a tu API
    // const response = await fetch(`${apiUrl}?fecha=${fecha}&personas=${personas}`);
    // const data = await response.json();

    // if (data.horarios.length === 0) {
    console.log(query);
    // const libros = [
    //     { titulo: 'Cien años de soledad', genero: 'ficcion' },
    //     { titulo: 'El arte de la guerra', genero: 'no-ficcion' }
    // ];

    // // 2. Crear botones dinámicos
    // const buttons1 = ;
    //
    // // 3. Enviar mensaje interactivo
    // await ctx.sendMessage({
    //     text: '📚 Libros disponibles:',
    //
    //     footer: 'Responde con el número del libro'
    // });

    // // Crea botones con enlaces a tu web
    // const buttons = data.horarios.map(({ hora, link }) => ({
    //     text: `Reservar a las ${hora}`,
    //     url: link
    // }));
    //
    // ctx.send({
    //     text: `¡Hay mesas disponibles! Elige un horario:`,
    //     buttons
    // });

})



/**
 * Función principal que configura y inicia el bot
 * @async
 * @returns {Promise<void>}
 */
const main = async () => {
    /**
     * Flujo del bot
     * @type {import('@builderbot/bot').Flow<BaileysProvider, MemoryDB>}
     */
    const adapterFlow = createFlow([welcomeFlow,disponibilidadFlow]);

    /**
     * Proveedor de servicios de mensajería
     * @type {BaileysProvider}
     */
    const adapterProvider = createProvider(BaileysProvider, {
        groupsIgnore: true,
        readStatus: false,
    });

    /**
     * Base de datos en memoria para el bot
     * @type {MemoryDB}
     */
    const adapterDB = new MemoryDB();

    /**
     * Configuración y creación del bot
     * @type {import('@builderbot/bot').Bot<BaileysProvider, MemoryDB>}
     */
    const { httpServer } = await createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    });


    httpInject(adapterProvider.server);
    httpServer(+PORT);
};

main();
