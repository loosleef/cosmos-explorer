/**
 * This adapter is responsible to render the React component
 * If the component signals a change through the callback passed in the properties, it must render the React component when appropriate
 * and update any knockout observables passed from the parent.
 */
import { CommandBar as FluentCommandBar, ICommandBarItemProps } from "@fluentui/react";
import { useNotebook } from "Explorer/Notebook/useNotebook";
import { userContext } from "UserContext";
import * as React from "react";
import create, { UseStore } from "zustand";
import { ConnectionStatusType, PoolIdType } from "../../../Common/Constants";
import { StyleConstants } from "../../../Common/StyleConstants";
import { Platform, configContext } from "../../../ConfigContext";
import { CommandButtonComponentProps } from "../../Controls/CommandButton/CommandButtonComponent";
import Explorer from "../../Explorer";
import { useSelectedNode } from "../../useSelectedNode";
import * as CommandBarComponentButtonFactory from "./CommandBarComponentButtonFactory";
import * as CommandBarUtil from "./CommandBarUtil";

interface Props {
  container: Explorer;
}

export interface CommandBarStore {
  contextButtons: CommandButtonComponentProps[];
  setContextButtons: (contextButtons: CommandButtonComponentProps[]) => void;
}

export const useCommandBar: UseStore<CommandBarStore> = create((set) => ({
  contextButtons: [],
  setContextButtons: (contextButtons: CommandButtonComponentProps[]) => set((state) => ({ ...state, contextButtons })),
}));

export const CommandBar: React.FC<Props> = ({ container }: Props) => {
  const selectedNodeState = useSelectedNode();
  const buttons = useCommandBar((state) => state.contextButtons);
  const backgroundColor = StyleConstants.BaseLight;

  if (userContext.apiType === "Postgres" || userContext.apiType === "VCoreMongo") {
    const buttons =
      userContext.apiType === "Postgres"
        ? CommandBarComponentButtonFactory.createPostgreButtons(container)
        : CommandBarComponentButtonFactory.createVCoreMongoButtons(container);
    return (
      <div className="commandBarContainer">
        <FluentCommandBar
          ariaLabel="Use left and right arrow keys to navigate between commands"
          items={CommandBarUtil.convertButton(buttons, backgroundColor)}
          styles={{
            root: { backgroundColor: backgroundColor },
          }}
          overflowButtonProps={{ ariaLabel: "More commands" }}
        />
      </div>
    );
  }

  const staticButtons = CommandBarComponentButtonFactory.createStaticCommandBarButtons(container, selectedNodeState);
  const contextButtons = (buttons || []).concat(
    CommandBarComponentButtonFactory.createContextCommandBarButtons(container, selectedNodeState),
  );
  const controlButtons = CommandBarComponentButtonFactory.createControlCommandBarButtons(container);

  const uiFabricStaticButtons = CommandBarUtil.convertButton(staticButtons, backgroundColor);
  if (buttons && buttons.length > 0) {
    uiFabricStaticButtons.forEach((btn: ICommandBarItemProps) => (btn.iconOnly = true));
  }

  const uiFabricTabsButtons: ICommandBarItemProps[] = CommandBarUtil.convertButton(contextButtons, backgroundColor);

  if (uiFabricTabsButtons.length > 0) {
    uiFabricStaticButtons.push(CommandBarUtil.createDivider("commandBarDivider"));
  }

  const uiFabricControlButtons = CommandBarUtil.convertButton(controlButtons, backgroundColor);
  uiFabricControlButtons.forEach((btn: ICommandBarItemProps) => (btn.iconOnly = true));

  const connectionInfo = useNotebook((state) => state.connectionInfo);

  if (
    (useNotebook.getState().isPhoenixNotebooks || useNotebook.getState().isPhoenixFeatures) &&
    connectionInfo?.status !== ConnectionStatusType.Connect
  ) {
    uiFabricControlButtons.unshift(
      CommandBarUtil.createConnectionStatus(container, PoolIdType.DefaultPoolId, "connectionStatus"),
    );
  }

  const rootStyle =
    configContext.platform === Platform.Fabric
      ? {
          root: {
            backgroundColor: "transparent",
            padding: "0px 14px 0px 14px",
          },
        }
      : {
          root: {
            backgroundColor: backgroundColor,
          },
        };

  return (
    <div className="commandBarContainer">
      <FluentCommandBar
        ariaLabel="Use left and right arrow keys to navigate between commands"
        items={uiFabricStaticButtons.concat(uiFabricTabsButtons)}
        farItems={uiFabricControlButtons}
        styles={rootStyle}
        overflowButtonProps={{ ariaLabel: "More commands" }}
      />
    </div>
  );
};
