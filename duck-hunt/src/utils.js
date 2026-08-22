export default function formatScore(score, nbDigits) {
  const scoreAsText = score.toString();
  let zerosToAdd = 0;
  if (scoreAsText.length < nbDigits) {
    zerosToAdd = nbDigits - scoreAsText.length;
  }
  let zeros = "";
  for (let i = 0; i < zerosToAdd; i++) {
    zeros += "0";
  }

  return zeros + score;
}
