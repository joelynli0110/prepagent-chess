from app.db.models import MoveClassification



def classify_by_cpl(cpl: int) -> MoveClassification:
    if cpl >= 200:
        return MoveClassification.blunder
    if cpl >= 100:
        return MoveClassification.mistake
    if cpl >= 50:
        return MoveClassification.inaccuracy
    if cpl >= 20:
        return MoveClassification.good
    return MoveClassification.best