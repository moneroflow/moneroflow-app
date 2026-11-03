import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

interface HelpContextType {
  helpEnabled: boolean;
  setHelpEnabled: (enabled: boolean) => void;
  helpText: string | null;
  helpTitle: string | null;
  openHelp: (title: string, text: string) => void;
  closeHelp: () => void;
}

const HelpContext = createContext<HelpContextType | undefined>(undefined);

export function HelpProvider({ children }: { children: ReactNode }) {
  const [helpEnabled, setHelpEnabled] = useState(false);
  const [helpText, setHelpText] = useState<string | null>(null);
  const [helpTitle, setHelpTitle] = useState<string | null>(null);

  const openHelp = useCallback((title: string, text: string) => {
    setHelpTitle(title);
    setHelpText(text);
  }, []);

  const closeHelp = useCallback(() => {
    setHelpTitle(null);
    setHelpText(null);
  }, []);

  return (
    <HelpContext.Provider value={{ helpEnabled, setHelpEnabled, helpText, helpTitle, openHelp, closeHelp }}>
      {children}
    </HelpContext.Provider>
  );
}

export function useHelp() {
  const context = useContext(HelpContext);
  if (context === undefined) {
    throw new Error('useHelp must be used within a HelpProvider');
  }
  return context;
}
