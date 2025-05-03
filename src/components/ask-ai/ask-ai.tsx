/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { RiSparkling2Fill } from "react-icons/ri";
import { GrSend } from "react-icons/gr";
import classNames from "classnames";
import { toast } from "react-toastify";
import { useLocalStorage } from "react-use";
import { MdPreview } from "react-icons/md";

import Login from "../login/login";
import { defaultHTML } from "../../../utils/consts";
import SuccessSound from "../../assets/success.mp3";
import Settings from "../settings/settings";
import ProModal from "../pro-modal/pro-modal";

function AskAI({
  html,
  setHtml,
  onScrollToBottom,
  isAiWorking,
  setisAiWorking,
  setView,
  onNewPrompt,
}: {
  html: string;
  setHtml: (html: string) => void;
  onScrollToBottom: () => void;
  isAiWorking: boolean;
  onNewPrompt: (prompt: string) => void;
  setView: React.Dispatch<React.SetStateAction<"editor" | "preview">>;
  setisAiWorking: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [hasAsked, setHasAsked] = useState(false);
  const [previousPrompt, setPreviousPrompt] = useState("");
  const [provider, setProvider] = useLocalStorage("provider", "openrouter");
  const [openProvider, setOpenProvider] = useState(false);
  const [providerError, setProviderError] = useState("");
  const [openProModal, setOpenProModal] = useState(false);
  const [localSettings, setLocalSettings] = useState(() => {
    const saved = localStorage.getItem("localSettings");
    return saved
      ? JSON.parse(saved)
      : {
          apiKey: "",
          apiUrl: "https://openrouter.ai/api/v1/chat/completions",
          model: "deepseek/deepseek-chat-v3-0324",
        };
  });

  const loadLocalSettings = () => {
    const saved = localStorage.getItem("localSettings");
    if (saved) {
      setLocalSettings(JSON.parse(saved));
    }
  };

  useEffect(() => {
    loadLocalSettings();
  }, []);

  const audio = new Audio(SuccessSound);
  audio.volume = 0.5;

  const callAi = async () => {
    if (isAiWorking || !prompt.trim()) return;

    setisAiWorking(true);
    setProviderError("");

    let contentResponse = "";
    let lastRenderTime = 0;

    try {
      onNewPrompt(prompt);

      const providerConfig: any = {
        prompt,
        provider,
        ...(provider === "local"
          ? {
              ApiKey: localSettings.apiKey,
              ApiUrl: localSettings.apiUrl,
              Model: localSettings.model,
            }
          : {}),
        ...(provider === "openrouter"
          ? {
              ApiKey: localSettings.apiKey,
              ApiUrl: localSettings.apiUrl,
              Model: localSettings.model,
            }
          : {}),
        ...(html === defaultHTML ? {} : { html }),
        ...(previousPrompt ? { previousPrompt } : {}),
      };

      const request = await fetch("/api/ask-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(providerConfig),
      });

      if (!request.ok) {
        const res = await request.json();
        if (res.openLogin) return setOpen(true);
        if (res.openSelectProvider) {
          setOpenProvider(true);
          setProviderError(res.message);
          return;
        }
        if (res.openProModal) return setOpenProModal(true);
        toast.error(res.message);
        return;
      }

      if (!request.body) return;

      const reader = request.body.getReader();
      const decoder = new TextDecoder("utf-8");

      const read = async () => {
        const { done, value } = await reader.read();
        if (done) {
          toast.success("AI respondeu com sucesso!");
          setPrompt("");
          setPreviousPrompt(prompt);
          setisAiWorking(false);
          setHasAsked(true);
          audio.play();
          setView("preview");

          const finalDoc = contentResponse.match(
            /<!DOCTYPE html>[\s\S]*<\/html>/
          )?.[0];
          if (finalDoc) {
            setHtml(finalDoc);
          }

          return;
        }

        const chunk = decoder.decode(value, { stream: true });
        contentResponse += chunk;

        const newHtml = contentResponse.match(/<!DOCTYPE html>[\s\S]*/)?.[0];
        if (newHtml) {
          let partialDoc = newHtml;
          if (!partialDoc.includes("</html>")) {
            partialDoc += "\n</html>";
          }

          const now = Date.now();
          if (now - lastRenderTime > 300) {
            setHtml(partialDoc);
            lastRenderTime = now;
          }

          if (partialDoc.length > 200) {
            onScrollToBottom();
          }
        }

        read();
      };

      read();
    } catch (error: any) {
      setisAiWorking(false);
      toast.error(error.message);
      if (error.openLogin) setOpen(true);
    }
  };

  return (
    <div
      className={`bg-gray-950 rounded-xl py-2 pl-3.5 pr-2 absolute bottom-3 left-3 w-[calc(100%-1.5rem)] z-10 group ${
        isAiWorking ? "animate-pulse" : ""
      }`}
    >
      {defaultHTML !== html && (
        <button
          className="bg-white lg:hidden absolute -translate-y-[calc(100%+8px)] left-0 top-0 text-xs font-medium py-2 px-3 rounded-lg"
          onClick={() => setView("preview")}
        >
          <MdPreview className="text-sm" />
          Ver Preview
        </button>
      )}
      <div className="w-full flex items-center justify-between">
        <RiSparkling2Fill className="text-lg text-gray-500" />
        <input
          type="text"
          disabled={isAiWorking}
          className="w-full bg-transparent px-3 text-white placeholder:text-gray-500 font-code outline-none"
          placeholder={
            hasAsked
              ? "O que mais você quer pedir à IA?"
              : "Digite aqui sua ideia..."
          }
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && callAi()}
        />
        <div className="flex items-center gap-2">
          <Settings
            provider={provider as string}
            onChange={setProvider}
            open={openProvider}
            error={providerError}
            onClose={setOpenProvider}
            setLocalSettings={setLocalSettings}
            localSettings={localSettings}
          />
          <button
            disabled={isAiWorking}
            className="rounded-full size-8 bg-pink-500 text-white flex items-center justify-center hover:bg-pink-400 disabled:bg-gray-300"
            onClick={callAi}
          >
            <GrSend className="-translate-x-[1px]" />
          </button>
        </div>
      </div>
      {open && (
        <div
          className="h-screen w-screen bg-black/20 fixed left-0 top-0 z-10"
          onClick={() => setOpen(false)}
        ></div>
      )}
      <Login html={html} />
      <ProModal
        html={html}
        open={openProModal}
        onClose={() => setOpenProModal(false)}
      />
    </div>
  );
}

export default AskAI;
