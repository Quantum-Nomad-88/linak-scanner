export const SPINDLE_PITCH = {
  '1': '2 mm', '2': '4 mm', '3': '6 mm', '4': '4 mm', '5': '5 mm',
  '6': '12 mm', '7': '6 mm', '8': '8 mm', '9': '9 mm',
};

export const IP_RATINGS = {
  '0': 'IPX1', '1': 'IPX4', '2': 'IP66', '3': 'IPX4', '4': 'IP54', '5': 'IPX6', '6': 'IPX6 Washable',
};

export const MOTOR_VOLTAGE = {
  '12': '12 V DC', '24': '24 V DC', '36': '36 V DC',
};

export const FEEDBACK_TYPES = {
  '0': 'None', B: 'Analogue 0–10 V', C: 'Analogue 0.5–4.5 V',
  E: 'Reed switch (10 pulses/rev)', M: 'Reed switch (4 pulses/rev)',
  P: 'Potentiometer', R: 'Reed switch (4 pulses/rev)', S: 'Single Hall',
  F: 'Analogue 0–10 V', K: 'Analogue 0.5–4.5 V', L: 'Hall (2 pulses/rev)',
  N: 'Hall (4 pulses/rev)', T: 'Potentiometer 0–10 V', D: 'None (no EOS out)',
  A: 'Reed switch',
};
