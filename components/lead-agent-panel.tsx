"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { initialLeadAgentState, runLeadAgentCommand } from "@/lib/lead-agent";

type SpeechResult = { isFinal: boolean; 0: { transcript: string } };
type SpeechResultEvent = { resultIndex: number; results: ArrayLike<SpeechResult> };
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export function LeadAgentPanel({ previewMode }: { previewMode: boolean }) {
  const [state, action, pending] = useActionState(runLeadAgentCommand, initialLeadAgentState);
  const [command, setCommand] = useState("");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const [recognitionSupported, setRecognitionSupported] = useState<boolean | null>(null);
  const [synthesisSupported, setSynthesisSupported] = useState<boolean | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const lastSpokenRef = useRef(initialLeadAgentState.response);

  useEffect(() => {
    const speechWindow = window as typeof window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
    setRecognitionSupported(Boolean(speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition));
    setSynthesisSupported("speechSynthesis" in window && "SpeechSynthesisUtterance" in window);
    return () => { recognitionRef.current?.stop(); window.speechSynthesis?.cancel(); };
  }, []);

  useEffect(() => {
    if (!synthesisSupported || state.response === lastSpokenRef.current) return;
    lastSpokenRef.current = state.response;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(state.response);
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => { setSpeaking(false); setSpeechError("Spoken response could not play."); };
    window.speechSynthesis.speak(utterance);
  }, [state.response, synthesisSupported]);

  const toggleListening = () => {
    if (listening) { recognitionRef.current?.stop(); return; }
    const speechWindow = window as typeof window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) { setSpeechError("Voice input is not supported in this browser."); return; }
    setSpeechError("");
    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";
    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) transcript += event.results[index][0].transcript;
      setCommand(transcript.trimStart().slice(0, 500));
    };
    recognition.onerror = (event) => { setSpeechError(event.error === "not-allowed" ? "Microphone permission was denied. Text commands still work." : event.error === "audio-capture" ? "No usable microphone was found. Text commands still work." : `Voice input stopped: ${event.error}.`); setListening(false); recognitionRef.current = null; };
    recognition.onend = () => { setListening(false); recognitionRef.current = null; };
    recognitionRef.current = recognition;
    try { recognition.start(); setListening(true); } catch { setSpeechError("Voice input could not start. Text commands still work."); }
  };

  const stopSpeaking = () => { window.speechSynthesis?.cancel(); setSpeaking(false); };

  return <section className="lead-command" aria-labelledby="lead-command-title">
    <div className="lead-command-head"><div><span>LEAD AGENT / COMMAND LAYER V1</span><h2 id="lead-command-title">Direct operations</h2></div><em>{previewMode ? "READ ONLY" : "GOVERNED"}</em></div>
    <form action={action}>
      <label htmlFor="lead-command-input">Operational command</label>
      <div className="lead-command-entry"><button className={`voice-control ${listening ? "listening" : ""}`} type="button" onClick={toggleListening} disabled={recognitionSupported === false} aria-label={listening ? "Stop listening" : "Talk to Lead Agent"} aria-pressed={listening}><span aria-hidden="true">{listening ? "■" : "●"}</span></button><input id="lead-command-input" name="command" value={command} onChange={(event) => setCommand(event.target.value)} maxLength={500} placeholder="What is waiting for approval?" required autoComplete="off" /><button type="submit" disabled={pending}>{pending ? "Interpreting…" : "Issue command"}</button></div>
      <div className="voice-status" aria-live="polite"><span>{listening ? "Listening — review transcript, then issue command" : recognitionSupported === false ? "Voice input unavailable · text commands ready" : "Tap microphone to speak"}</span>{speechError && <strong>{speechError}</strong>}</div>
    </form>
    <div className="lead-command-result" aria-live="polite"><strong>{state.mode ?? "READY"}</strong><p>{state.response}</p>{speaking && <button className="stop-speaking" type="button" onClick={stopSpeaking} aria-label="Stop spoken response">Stop voice</button>}<dl><div><dt>Action</dt><dd>{state.action}</dd></div><div><dt>Approval</dt><dd>{state.approval}</dd></div>{synthesisSupported === false && <div><dt>Voice</dt><dd>Spoken replies unavailable</dd></div>}</dl></div>
    <p className="lead-command-scope">Reads operational state · creates bounded internal tasks · delegates running work {previewMode ? "· preview mutations blocked" : ""}</p>
  </section>;
}
