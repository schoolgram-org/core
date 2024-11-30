import NS from "netschoolapi";

const user = new NS({
  origin: "https://example.com",
  login: "Иванов",
  password: "123456",
  school: "МБОУ ...", // Название школы (полностью) или её id
});

(async function () {
  // Получаем дневник
  const diary = await user.diary();
  console.log(diary.days[0].lessons[2]);
})();
