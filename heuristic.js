userSettings = {salty: [6, 9], spicy: [2, 7], sweet: [8, 10], fruity: [3, 7], excludeIngredients: ['Peanuts'], title: ['Ice Cream', 'Steak']};
foodToTry = {characteristics: ['fruity', 'sweet'], ingredients: ['Apple', 'Ice Cream'], itemTitle: 'Ice Cream Sundae with Apple Pie'};

function heuristic(userSettings, foodToTry) {
    for (var i = 0; i< userSettings.excludeIngredients.length; i++)
        if (foodToTry.ingredients.indexOf(userSettings.excludeIngredients[i]) >= 0)
            return 0;
    sum = 0;
    n = 0;
    for (var i = 0;  i < foodToTry.characteristics.length; i++){
        attr = foodToTry.characteristics[i];
        probs = userSettings[attr];
        sum += probs[0]/probs[1];
        n++;
    }
    probability = sum/n;
    for (var i = 0; i < userSettings.title.length; i++)
        if (foodToTry.itemTitle.indexOf(userSettings.title[i]) >= 0)
            probability += 0.1;
    if (probability > 1) probability = 1;
    if (probability < 0) probability = 0;
    return probability;
}

console.log(heuristic(userSettings, foodToTry));