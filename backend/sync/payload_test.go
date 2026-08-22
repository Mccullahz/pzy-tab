package sync

import (
	"encoding/json"
	"testing"
)

// the PZY storefront nests the contract's top-level extras inside `payload`.
// we read either placement (§10 tolerant reading).
func TestNestedPayloadIsLifted(t *testing.T) {
	raw := []byte(`{
		"event_id":"s1","order_id":"o1","type":"order.created","source":"store",
		"contract_version":"0.1.0",
		"payload":{
			"items":[{"name":"Kanzu Washed","quantity":1,"net_weight_grams":340}],
			"total_weight_grams":340,
			"placed_at":"2026-08-08T12:00:00Z"
		}
	}`)

	var e Event
	if err := json.Unmarshal(raw, &e); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if e.TotalWeightG != 340 {
		t.Fatalf("total weight not lifted: %d", e.TotalWeightG)
	}
	if e.PlacedAt != "2026-08-08T12:00:00Z" {
		t.Fatalf("placed_at not lifted: %q", e.PlacedAt)
	}
	var items []map[string]any
	if err := json.Unmarshal(e.Items, &items); err != nil || len(items) != 1 {
		t.Fatalf("items not lifted: %s (%v)", e.Items, err)
	}
	if items[0]["name"] != "Kanzu Washed" {
		t.Fatalf("wrong item lifted: %v", items[0])
	}
}

func TestTopLevelWinsOverPayload(t *testing.T) {
	raw := []byte(`{
		"event_id":"s1","order_id":"o1","type":"order.created","source":"store",
		"contract_version":"0.1.0",
		"total_weight_grams":680,
		"payload":{"total_weight_grams":340}
	}`)

	var e Event
	if err := json.Unmarshal(raw, &e); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if e.TotalWeightG != 680 {
		t.Fatalf("payload overrode the top-level field: %d", e.TotalWeightG)
	}
}

func TestNestedHoldAndShipmentFields(t *testing.T) {
	var hold Event
	if err := json.Unmarshal([]byte(`{"event_id":"s1","order_id":"o1","type":"fulfillment.hold",
		"source":"store","contract_version":"0.1.0","payload":{"reason":"out of stock"}}`), &hold); err != nil {
		t.Fatalf("unmarshal hold: %v", err)
	}
	if hold.Reason != "out of stock" {
		t.Fatalf("reason not lifted: %q", hold.Reason)
	}

	var ship Event
	if err := json.Unmarshal([]byte(`{"event_id":"s2","order_id":"o1","type":"shipment.updated",
		"source":"store","contract_version":"0.1.0",
		"payload":{"tracking_number":"1Z999","carrier":"UPS"}}`), &ship); err != nil {
		t.Fatalf("unmarshal shipment: %v", err)
	}
	if ship.TrackingNumber != "1Z999" || ship.Carrier != "UPS" {
		t.Fatalf("shipment fields not lifted: %q %q", ship.TrackingNumber, ship.Carrier)
	}
}

// a payload that isn't an object must not fail the whole event: the ladder
// fields it carries are still valid.
func TestUnreadablePayloadIsTolerated(t *testing.T) {
	var e Event
	err := json.Unmarshal([]byte(`{"event_id":"s1","order_id":"o1","type":"fulfillment.transition",
		"to_status":"shipped","source":"store","contract_version":"0.1.0","payload":"not-an-object"}`), &e)
	if err != nil {
		t.Fatalf("unmarshal should tolerate an odd payload: %v", err)
	}
	if e.ToStatus != "shipped" {
		t.Fatalf("ladder fields lost: %q", e.ToStatus)
	}
}

// an order pulled from the store must reach the board with its line items, or
// the roast floor sees a bare id and can't roast it.
func TestStoreShapedOrderReachesTheBoardWithItems(t *testing.T) {
	l := NewLog()
	var e Event
	json.Unmarshal([]byte(`{"event_id":"s1","order_id":"o1","type":"order.created","source":"store",
		"contract_version":"0.1.0","payload":{"items":[{"name":"Kanzu Washed"}],"total_weight_grams":340}}`), &e)

	if out, _ := l.Apply(e); out != OutcomeApplied {
		t.Fatalf("apply: %s", out)
	}
	board := l.Orders()
	if len(board) != 1 || board[0].TotalWeightG != 340 || len(board[0].Items) == 0 {
		t.Fatalf("order reached the board without its details: %+v", board)
	}
}
