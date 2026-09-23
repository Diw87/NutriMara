import test from "node:test";
import assert from "node:assert/strict";
import { indexedDB } from "fake-indexeddb";
import { createLocalStore } from "../pwa/local-store.ts";

const fresh = () => createLocalStore(`test-${crypto.randomUUID()}`, indexedDB);
async function mutate(store, body) {
  const response = await store.request("/api/workspace", { method: "POST", body: JSON.stringify(body) });
  return { status: response.status, ...(await response.json()) };
}
async function workspace(store) { return (await store.request("/api/workspace")).json(); }
const patient = { action: "createPatient", name: "Paciente de teste", phone: "", birthDate: "", goal: "Acompanhamento", notes: "" };
const front = { width: 600, height: 1200, head: { x: .5, y: .1 }, feet: { x: .5, y: .9 }, left: { x: .3, y: .5 }, right: { x: .7, y: .5 } };
const side = { ...front, left: { x: .4, y: .5 }, right: { x: .6, y: .5 } };
function photos(patientId) {
  const form = new FormData();
  Object.entries({ patientId, measuredOn: "2026-09-23", heightCm: 180, consent: "yes", marks: JSON.stringify({ front, side }) }).forEach(([key, value]) => form.set(key, String(value)));
  const jpg = new Blob([new Uint8Array([255,216,255,224,0,0,0,0,0,0,255,217])], { type: "image/jpeg" });
  form.set("front", jpg, "front.jpg"); form.set("side", jpg, "side.jpg");
  return form;
}

test("cadastros persistem em outra conexão e mantêm consultas, medidas e plano", async () => {
  const name = `test-${crypto.randomUUID()}`;
  const store = createLocalStore(name, indexedDB);
  const created = await mutate(store, patient);
  assert.equal(created.status, 201);
  const appointment = await mutate(store, { action: "createAppointment", patientId: created.id, startsAt: "2026-10-01T09:00", kind: "Consulta", notes: "" });
  assert.equal(appointment.status, 201);
  await mutate(store, { action: "setAppointmentStatus", id: appointment.id, status: "Concluída" });
  await mutate(store, { action: "addMeasurement", patientId: created.id, measuredOn: "2026-09-23", weightKg: 80, waistCm: 90, notes: "" });
  await mutate(store, { action: "savePlan", patientId: created.id, title: "Plano inicial", instructions: "", meals: [{ time: "12:00", label: "Almoço", foods: "Arroz e feijão" }] });
  await mutate(store, { action: "savePlan", patientId: created.id, title: "Plano atualizado", instructions: "", meals: [{ time: "12:00", label: "Almoço", foods: "Arroz, feijão e legumes" }] });
  const saved = await workspace(createLocalStore(name, indexedDB));
  assert.equal(saved.patients[0].name, "Paciente de teste");
  assert.equal(saved.appointments[0].status, "Concluída");
  assert.equal(saved.measurements[0].weightKg, 80);
  assert.equal(saved.plans.length, 1);
  assert.equal(saved.plans[0].title, "Plano atualizado");
});

test("rejeita vínculos inexistentes e dados fora dos limites sem gravar", async () => {
  const store = fresh();
  const bad = await mutate(store, { action: "addMeasurement", patientId: 999, measuredOn: "2026-09-23", weightKg: 80, waistCm: null });
  assert.equal(bad.status, 404);
  assert.equal((await mutate(store, { ...patient, name: "" })).status, 400);
  assert.equal((await workspace(store)).patients.length, 0);
  assert.equal((await workspace(store)).measurements.length, 0);
});

test("fotos ficam locais e a exclusão remove imagem e avaliação juntas", async () => {
  const store = fresh();
  const { id } = await mutate(store, patient);
  const response = await store.request("/api/photos", { method: "POST", body: photos(id) });
  assert.equal(response.status, 201);
  const saved = await response.json();
  const url = await store.photoUrl(saved.id, "front");
  assert.ok(url.startsWith("blob:"));
  assert.equal((await (await fetch(url)).blob()).type, "image/jpeg");
  URL.revokeObjectURL(url);
  assert.equal((await workspace(store)).photoAssessments.length, 1);
  assert.equal((await store.request(`/api/photos?id=${saved.id}`, { method: "DELETE" })).status, 200);
  assert.equal((await workspace(store)).photoAssessments.length, 0);
  await assert.rejects(store.photoUrl(saved.id, "front"));
});

test("backup recupera fotos e vínculos sem apagar cadastros locais nem duplicar importação", async () => {
  const source = fresh();
  const { id } = await mutate(source, patient);
  await mutate(source, { action: "addMeasurement", patientId: id, measuredOn: "2026-09-23", weightKg: 81, waistCm: null, notes: "" });
  await source.request("/api/photos", { method: "POST", body: photos(id) });
  const backup = JSON.parse(JSON.stringify(await source.exportBackup()));
  const target = fresh();
  await mutate(target, { ...patient, name: "Cadastro existente" });
  assert.equal((await target.importBackup(backup)).addedPatients, 1);
  const restored = await workspace(target);
  assert.equal(restored.patients.length, 2);
  const importedId = restored.patients.find(p => p.name === "Paciente de teste").id;
  assert.notEqual(importedId, 1);
  assert.equal(restored.measurements[0].patientId, importedId);
  assert.equal(restored.photoAssessments[0].patientId, importedId);
  const url = await target.photoUrl(restored.photoAssessments[0].id, "side");
  assert.equal((await (await fetch(url)).arrayBuffer()).byteLength, 12);
  URL.revokeObjectURL(url);
  await assert.rejects(target.importBackup(backup), /já foi importada/);
  assert.equal((await workspace(target)).patients.length, 2);
});

test("backup inválido é rejeitado por inteiro, preservando o banco", async () => {
  const source = fresh();
  const { id } = await mutate(source, patient);
  await mutate(source, { action: "addMeasurement", patientId: id, measuredOn: "2026-09-23", weightKg: 81, waistCm: null, notes: "" });
  const backup = await source.exportBackup();
  backup.workspace.measurements[0].patientId = 999;
  const target = fresh();
  await mutate(target, { ...patient, name: "Não apagar" });
  await assert.rejects(target.importBackup(backup));
  assert.deepEqual((await workspace(target)).patients.map(p => p.name), ["Não apagar"]);
  backup.workspace.measurements[0].patientId = id;
  backup.workspace.measurements[0].weightKg = null;
  await assert.rejects(target.importBackup(backup));
  assert.deepEqual((await workspace(target)).patients.map(p => p.name), ["Não apagar"]);
  await assert.rejects(target.importBackup({ version: 999 }));
});
