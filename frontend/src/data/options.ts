export const districts = [
  "Все районы",
  "Баргузинский район",
  "Кабанский район",
  "Иволгинский район",
  "Заиграевский район",
] as const;

export const hazardClassFilters = [
  { value: "all", label: "Все классы" },
  { value: "1", label: "I - отсутствует" },
  { value: "2", label: "II - малая" },
  { value: "3", label: "III - средняя" },
  { value: "4", label: "IV - высокая" },
  { value: "5", label: "V - чрезвычайная" },
] as const;

export const statusFilters = [
  "Все статусы",
  "Результат получен",
  "В обработке",
  "Ошибка",
] as const;
