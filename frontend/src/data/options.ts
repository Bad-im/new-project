export const districts = [
  "Все районы",
  "Баргузинский район",
  "Кабанский район",
  "Иволгинский район",
  "Заиграевский район",
] as const;

export const hazardClassFilters = [
  { value: "all", label: "Все классы" },
  { value: "1", label: "1 - низкая" },
  { value: "2", label: "2 - умеренная" },
  { value: "3", label: "3 - средняя" },
  { value: "4", label: "4 - высокая" },
  { value: "5", label: "5 - чрезвычайная" },
] as const;

export const statusFilters = [
  "Все статусы",
  "Результат получен",
  "В обработке",
  "Ошибка",
] as const;
