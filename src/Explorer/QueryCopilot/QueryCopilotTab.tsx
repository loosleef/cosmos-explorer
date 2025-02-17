/* eslint-disable no-console */
import { Stack } from "@fluentui/react";
import { QueryCopilotSampleContainerId, QueryCopilotSampleDatabaseId } from "Common/Constants";
import { CommandButtonComponentProps } from "Explorer/Controls/CommandButton/CommandButtonComponent";
import { EditorReact } from "Explorer/Controls/Editor/EditorReact";
import { useCommandBar } from "Explorer/Menus/CommandBar/CommandBarComponentAdapter";
import { SaveQueryPane } from "Explorer/Panes/SaveQueryPane/SaveQueryPane";
import { QueryCopilotPromptbar } from "Explorer/QueryCopilot/QueryCopilotPromptbar";
import { OnExecuteQueryClick } from "Explorer/QueryCopilot/Shared/QueryCopilotClient";
import { QueryCopilotProps } from "Explorer/QueryCopilot/Shared/QueryCopilotInterfaces";
import { QueryCopilotResults } from "Explorer/QueryCopilot/Shared/QueryCopilotResults";
import { userContext } from "UserContext";
import { useQueryCopilot } from "hooks/useQueryCopilot";
import { useSidePanel } from "hooks/useSidePanel";
import { ReactTabKind, TabsState, useTabs } from "hooks/useTabs";
import React, { useState } from "react";
import SplitterLayout from "react-splitter-layout";
import QueryCommandIcon from "../../../images/CopilotCommand.svg";
import ExecuteQueryIcon from "../../../images/ExecuteQuery.svg";
import SaveQueryIcon from "../../../images/save-cosmos.svg";
import * as StringUtility from "../../Shared/StringUtility";

export const QueryCopilotTab: React.FC<QueryCopilotProps> = ({ explorer }: QueryCopilotProps): JSX.Element => {
  const { query, setQuery, selectedQuery, setSelectedQuery, isGeneratingQuery } = useQueryCopilot();

  const cachedCopilotToggleStatus: string = localStorage.getItem(
    `${userContext.databaseAccount?.id}-queryCopilotToggleStatus`,
  );
  const copilotInitialActive: boolean = cachedCopilotToggleStatus
    ? StringUtility.toBoolean(cachedCopilotToggleStatus)
    : true;
  const [copilotActive, setCopilotActive] = useState<boolean>(copilotInitialActive);
  const [tabActive, setTabActive] = useState<boolean>(true);

  const getCommandbarButtons = (): CommandButtonComponentProps[] => {
    const executeQueryBtnLabel = selectedQuery ? "Execute Selection" : "Execute Query";
    const executeQueryBtn = {
      iconSrc: ExecuteQueryIcon,
      iconAlt: executeQueryBtnLabel,
      onCommandClick: () => OnExecuteQueryClick(useQueryCopilot),
      commandButtonLabel: executeQueryBtnLabel,
      ariaLabel: executeQueryBtnLabel,
      hasPopup: false,
      disabled: query?.trim() === "",
    };

    const saveQueryBtn = {
      iconSrc: SaveQueryIcon,
      iconAlt: "Save Query",
      onCommandClick: () =>
        useSidePanel.getState().openSidePanel("Save Query", <SaveQueryPane explorer={explorer} queryToSave={query} />),
      commandButtonLabel: "Save Query",
      ariaLabel: "Save Query",
      hasPopup: false,
      disabled: true,
    };

    const toggleCopilotButton = {
      iconSrc: QueryCommandIcon,
      iconAlt: "Copilot",
      onCommandClick: () => {
        toggleCopilot(true);
      },
      commandButtonLabel: "Copilot",
      ariaLabel: "Copilot",
      hasPopup: false,
      disabled: copilotActive,
    };

    return [executeQueryBtn, saveQueryBtn, toggleCopilotButton];
  };

  React.useEffect(() => {
    useCommandBar.getState().setContextButtons(getCommandbarButtons());
  }, [query, selectedQuery, copilotActive]);

  React.useEffect(() => {
    return () => {
      useTabs.subscribe((state: TabsState) => {
        if (state.activeReactTab === ReactTabKind.QueryCopilot) {
          setTabActive(true);
        } else {
          setTabActive(false);
        }
      });
    };
  }, []);

  const toggleCopilot = (toggle: boolean) => {
    setCopilotActive(toggle);
    localStorage.setItem(`${userContext.databaseAccount?.id}-queryCopilotToggleStatus`, toggle.toString());
  };

  return (
    <Stack className="tab-pane" style={{ width: "100%" }}>
      <div style={isGeneratingQuery ? { height: "100%" } : { overflowY: "auto", height: "100%" }}>
        {tabActive && copilotActive && (
          <QueryCopilotPromptbar
            explorer={explorer}
            toggleCopilot={toggleCopilot}
            databaseId={QueryCopilotSampleDatabaseId}
            containerId={QueryCopilotSampleContainerId}
          ></QueryCopilotPromptbar>
        )}
        <Stack className="tabPaneContentContainer">
          <SplitterLayout percentage={true} vertical={true} primaryIndex={0} primaryMinSize={30} secondaryMinSize={70}>
            <EditorReact
              language={"sql"}
              content={query}
              isReadOnly={false}
              wordWrap={"on"}
              ariaLabel={"Editing Query"}
              lineNumbers={"on"}
              onContentChanged={(newQuery: string) => setQuery(newQuery)}
              onContentSelected={(selectedQuery: string) => setSelectedQuery(selectedQuery)}
            />
            <QueryCopilotResults />
          </SplitterLayout>
        </Stack>
      </div>
    </Stack>
  );
};
