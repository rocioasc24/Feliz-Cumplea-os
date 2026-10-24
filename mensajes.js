// =====================================================
//  TEXTOS PERSONALIZABLES
//  Cambia aquí cualquier frase sin tocar el resto del código.
//  Cada mensaje tiene dos líneas: ['línea 1', 'línea 2']
//  Sin mensaje: ['', '']    Una sola línea: ['Hola', '']
// =====================================================
const CONFIG = {
  firma: 'Tu hermanita',

  // Velas 1 a 27: solo ánimo y avance (la 28 es especial, está más abajo)
  velas: [
    ['Pide un deseo...', 'y sopla la primera vela'],
    ['¡Una menos!', 'vamos por la segunda'],
    ['Tres velitas...', 'esto apenas empieza'],
    ['4', ''],
    ['Cinco de 28...', ''],
    ['6', ''],
    ['Siete...', ''],
    ['Ocho velitas', ''],
    ['', ''],
    ['¡Diez!', ''],
    ['', ''],
    ['', ''],
    ['Trece velitas', 'y contando'],
    ['¡Ya vas a la mitad!', ''],
    ['', ''],
    ['Dieciséis...', ''],
    ['', ''],
    ['Dieciocho...', 'ya se ven las últimas'],
    ['', ''],
    ['¡Veinte!', 'ya te falta poco'],
    ['', ''],
    ['', ''],
    ['', ''],
    ['', ''],
    ['Veinticinco...', 'ya te falta poquito'],
    ['¡Ya casi!', 'tres velitas más y listo'],
    ['Penúltima velita...', 'después solo queda una'],
  ],

  // La vela 28: no se deja apagar a la primera
  ultimaVela: {
    pedir:  ['Ándele...', 'déjame esta velita 🥺'],
    deseos: ['Y con esta última velita...', 'todos mis deseos para ti ✨'],
  },

  // Deseos que se esfuman en el humo de la última vela
  deseos: [
    'Deseo que nunca te falten motivos para sonreír.',
    'Que la vida te sorprenda con cosas bonitas.',
    'Deseo que siempre tengas salud y tranquilidad.',
    'Que nunca te falte el amor de las personas que te quieren.',
    'Que tengas valentía para enfrentar cualquier situación.',
    'Deseo que cada esfuerzo te acerque a tus metas.',
    'Que encuentres felicidad incluso en los días más sencillos.',
    'Que nunca pierdas la confianza en ti mismo.',
    'Que tengas éxito en todo lo que te propongas.',
    'Deseo que te rodees de personas sinceras.',
    'Que nunca te falten nuevas oportunidades.',
    'Que tengas paciencia para esperar lo bueno y sabiduría para reconocerlo.',
    'Deseo que cada año te conviertas en una mejor versión de ti mismo.',
    'Que nunca dejes de aprender cosas nuevas.',
    'Que tengas paz en tu corazón y claridad en tus decisiones.',
    'Que encuentres personas que celebren tus logros de corazón.',
    'Que nunca te falten motivos para sentirte orgulloso de ti mismo.',
    'Deseo que tengas estabilidad y prosperidad en tu vida.',
    'Que puedas cumplir esas metas que todavía guardas en secreto.',
    'Que, incluso cuando las cosas no salgan como esperas, encuentres algo bueno que aprender.',
    'Deseo que seas muy feliz, hoy, mañana y en cada etapa de tu vida.',
    'No tienes que ser perfecto para ser alguien extraordinario.',
    'Nunca pierdas esa parte de ti que te hace único.',
  ],

  // Mensajes cuando aparece el pastel con las velas apagadas
  pastel: [
    ['28 velitas apagadas...', '...y todos tus deseos ya van en camino'],
    ['Hoy cumples 28 años, hermano,', 'pero por dentro siempre serás el niño del sol ☀️'],
    ['Ese niño que corría, saltaba', 'y no se rendía hasta pasar el nivel'],
    ['Así que, niño del sol...', '...es hora de probar tus habilidades'],
    ['Te esperan 5 juegos', 'que marcaron parte de tu vida. ¿Listo?'],
  ],

  // Mensaje al ganar cada juego (en orden)
  victorias: [
    '¡Yoshi! ¡Mela-mela!',
    'El huevo se rompió... ¡y la dimensión final es tuya!',
    'Estrategia de campeón: impecable.',
    '¡Saliste del laberinto sin un rasguño!',
    '!jajajajaja',
  ],

  // Mensajes de la pantalla final
  final: [
    ['¡Lo lograste!', 'Ganaste los 5 juegos, sos buenardo'],
    ['Viste sigues siendo aquel niño del sol', ''],
    ['Feliz cumpleaños número 28, hermano', 'te quiero muchísimo ❤️'],
  ],
};
