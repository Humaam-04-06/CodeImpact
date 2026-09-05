from model_service import ModelService

def test_predict_sentiment():
    """Unit test for sentiment prediction logic."""
    service = ModelService()
    res = service.predict_sentiment("This is a great product!")
    assert res["label"] == "POSITIVE"
