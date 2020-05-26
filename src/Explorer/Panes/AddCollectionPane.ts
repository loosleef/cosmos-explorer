import * as _ from "underscore";
import * as AddCollectionUtility from "../../Shared/AddCollectionUtility";
import * as AutoPilotUtils from "../../Utils/AutoPilotUtils";
import * as Constants from "../../Common/Constants";
import * as DataModels from "../../Contracts/DataModels";
import * as ErrorParserUtility from "../../Common/ErrorParserUtility";
import * as ko from "knockout";
import * as PricingUtils from "../../Utils/PricingUtils";
import * as SharedConstants from "../../Shared/Constants";
import * as ViewModels from "../../Contracts/ViewModels";
import editable from "../../Common/EditableUtility";
import EnvironmentUtility from "../../Common/EnvironmentUtility";
import Q from "q";
import TelemetryProcessor from "../../Shared/Telemetry/TelemetryProcessor";
import { Action, ActionModifiers } from "../../Shared/Telemetry/TelemetryConstants";
import { config, Platform } from "../../Config";
import { ContextualPaneBase } from "./ContextualPaneBase";
import { CosmosClient } from "../../Common/CosmosClient";
import { createMongoCollectionWithARM, createMongoCollectionWithProxy } from "../../Common/MongoProxyClient";
import { DynamicListItem } from "../Controls/DynamicList/DynamicListComponent";
import { HashMap } from "../../Common/HashMap";
import { PlatformType } from "../../PlatformType";

export default class AddCollectionPane extends ContextualPaneBase implements ViewModels.AddCollectionPane {
  public defaultExperience: ko.Computed<string>;
  public databaseIds: ko.ObservableArray<string>;
  public collectionId: ko.Observable<string>;
  public collectionIdTitle: ko.Observable<string>;
  public databaseId: ko.Observable<string>;
  public databaseCreateNew: ko.Observable<boolean>;
  public collectionWithThroughputInSharedTitle: ko.Observable<string>;
  public collectionWithThroughputInShared: ko.Observable<boolean>;
  public databaseCreateNewShared: ko.Observable<boolean>;
  public databaseHasSharedOffer: ko.Observable<boolean>;
  public formErrorsDetails: ko.Observable<string>;
  public formWarnings: ko.Observable<string>;
  public partitionKey: ko.Observable<string>;
  public partitionKeyName: ko.Computed<string>;
  public lowerCasePartitionKeyName: ko.Computed<string>;
  public partitionKeyVisible: ko.Computed<boolean>;
  public partitionKeyPattern: ko.Computed<string>;
  public partitionKeyTitle: ko.Computed<string>;
  public rupm: ko.Observable<string>;
  public rupmVisible: ko.Observable<boolean>;
  public storage: ko.Observable<string>;
  public throughputSinglePartition: ViewModels.Editable<number>;
  public throughputMultiPartition: ViewModels.Editable<number>;
  public throughputDatabase: ViewModels.Editable<number>;
  public isPreferredApiTable: ko.Computed<boolean>;
  public partitionKeyPlaceholder: ko.Computed<string>;
  public isTryCosmosDBSubscription: ko.Computed<boolean>;
  public maxThroughputRU: ko.Observable<number>;
  public minThroughputRU: ko.Observable<number>;
  public throughputRangeText: ko.Computed<string>;
  public sharedThroughputRangeText: ko.Computed<string>;
  public throughputSpendAckText: ko.Observable<string>;
  public throughputSpendAck: ko.Observable<boolean>;
  public throughputSpendAckVisible: ko.Computed<boolean>;
  public maxCollectionsReached: ko.Computed<boolean>;
  public maxCollectionsReachedMessage: ko.Observable<string>;
  public requestUnitsUsageCost: ko.Computed<string>;
  public dedicatedRequestUnitsUsageCost: ko.Computed<string>;
  public canRequestSupport: ko.PureComputed<boolean>;
  public largePartitionKey: ko.Observable<boolean> = ko.observable<boolean>(false);
  public useIndexingForSharedThroughput: ko.Observable<boolean> = ko.observable<boolean>(true);
  public costsVisible: ko.PureComputed<boolean>;
  public uniqueKeysVisible: ko.Computed<boolean>;
  public uniqueKeys: ko.ObservableArray<DynamicListItem>;
  public uniqueKeysPlaceholder: ko.Computed<string>;
  public upsellMessage: ko.PureComputed<string>;
  public upsellMessageAriaLabel: ko.PureComputed<string>;
  public debugstring: ko.Computed<string>;
  public displayCollectionThroughput: ko.Computed<boolean>;
  public isAutoPilotSelected: ko.Observable<boolean>;
  public selectedAutoPilotTier: ko.Observable<DataModels.AutopilotTier>;
  public selectedSharedAutoPilotTier: ko.Observable<DataModels.AutopilotTier>;
  public autoPilotTiersList: ko.ObservableArray<ViewModels.DropdownOption<DataModels.AutopilotTier>>;
  public sharedAutoPilotTiersList: ko.ObservableArray<ViewModels.DropdownOption<DataModels.AutopilotTier>>;
  public isSharedAutoPilotSelected: ko.Observable<boolean>;
  public autoPilotThroughput: ko.Observable<number>;
  public sharedAutoPilotThroughput: ko.Observable<number>;
  public autoPilotUsageCost: ko.Computed<string>;
  public shouldUseDatabaseThroughput: ko.Computed<boolean>;
  public isFreeTierAccount: ko.Computed<boolean>;
  public showIndexingOptionsForSharedThroughput: ko.Computed<boolean>;
  public showAnalyticalStore: ko.Computed<boolean>;
  public showEnableSynapseLink: ko.Computed<boolean>;
  public isSynapseLinkSupported: ko.Computed<boolean>;
  public isAnalyticalStorageOn: ko.Observable<boolean>;
  public isSynapseLinkUpdating: ko.Computed<boolean>;
  public canExceedMaximumValue: ko.PureComputed<boolean>;
  public hasAutoPilotV2FeatureFlag: ko.PureComputed<boolean>;
  public ruToolTipText: ko.Computed<string>;

  private _databaseOffers: HashMap<DataModels.Offer>;
  private _isSynapseLinkEnabled: ko.Computed<boolean>;

  constructor(options: ViewModels.AddCollectionPaneOptions) {
    super(options);
    this._databaseOffers = new HashMap<DataModels.Offer>();
    this.hasAutoPilotV2FeatureFlag = ko.pureComputed(() => this.container.hasAutoPilotV2FeatureFlag());
    this.ruToolTipText = ko.pureComputed(() => PricingUtils.getRuToolTipText(this.hasAutoPilotV2FeatureFlag()));
    this.formWarnings = ko.observable<string>();
    this.collectionId = ko.observable<string>();
    this.databaseId = ko.observable<string>();
    this.databaseCreateNew = ko.observable<boolean>(true);
    this.databaseCreateNewShared = ko.observable<boolean>(this.getSharedThroughputDefault());
    this.container.subscriptionType &&
      this.container.subscriptionType.subscribe(subscriptionType => {
        this.databaseCreateNewShared(this.getSharedThroughputDefault());
      });
    this.collectionWithThroughputInShared = ko.observable<boolean>(false);
    this.databaseIds = ko.observableArray<string>();
    this.uniqueKeys = ko.observableArray<DynamicListItem>();

    if (this.container) {
      this.container.databases.subscribe((newDatabases: ViewModels.Database[]) => {
        this._onDatabasesChange(newDatabases);
      });
      this._onDatabasesChange(this.container.databases());
    }

    this.isPreferredApiTable = options.isPreferredApiTable;
    this.partitionKey = ko.observable<string>();
    this.partitionKey.subscribe((newPartitionKey: string) => {
      if (this.container.isPreferredApiMongoDB() || !newPartitionKey || newPartitionKey[0] === "/") {
        return;
      }

      this.partitionKey(`/${newPartitionKey}`);
    });
    this.partitionKey.extend({ rateLimit: 100 });
    this.partitionKeyPattern = ko.pureComputed(() => {
      if (this.container && this.container.isPreferredApiGraph()) {
        return "^\/[^\/]*";
      }
      return ".*";
    });
    this.partitionKeyTitle = ko.pureComputed(() => {
      if (this.container && this.container.isPreferredApiGraph()) {
        return "May not use composite partition key";
      }
      return "";
    });
    this.rupm = ko.observable<string>(Constants.RUPMStates.off);
    this.rupmVisible = ko.observable<boolean>(false);
    const featureSubcription = this.container.features.subscribe(() => {
      this.rupmVisible(this.container.isFeatureEnabled(Constants.Features.enableRupm));
      featureSubcription.dispose();
    });

    this.canExceedMaximumValue = ko.pureComputed(() => this.container.canExceedMaximumValue());

    this.storage = ko.observable<string>();
    this.throughputSinglePartition = editable.observable<number>();
    this.throughputMultiPartition = editable.observable<number>();
    this.throughputDatabase = editable.observable<number>();
    this.collectionIdTitle = ko.observable<string>();
    this.collectionWithThroughputInSharedTitle = ko.observable<string>();
    this.maxThroughputRU = ko.observable<number>();
    this.minThroughputRU = ko.observable<number>();
    this.throughputSpendAckText = ko.observable<string>();
    this.throughputSpendAck = ko.observable<boolean>(false);
    this.maxCollectionsReachedMessage = ko.observable<string>();
    this.databaseHasSharedOffer = ko.observable<boolean>(true);
    this.throughputRangeText = ko.pureComputed<string>(() => {
      if (this.isAutoPilotSelected()) {
        return AutoPilotUtils.getAutoPilotHeaderText(this.hasAutoPilotV2FeatureFlag());
      }
      return `Throughput (${this.minThroughputRU().toLocaleString()} - ${this.maxThroughputRU().toLocaleString()} RU/s)`;
    });
    this.sharedThroughputRangeText = ko.pureComputed<string>(() => {
      if (this.isSharedAutoPilotSelected()) {
        return AutoPilotUtils.getAutoPilotHeaderText(this.hasAutoPilotV2FeatureFlag());
      }
      return `Throughput (${this.minThroughputRU().toLocaleString()} - ${this.maxThroughputRU().toLocaleString()} RU/s)`;
    });

    this.databaseId(options.databaseId);

    this.requestUnitsUsageCost = ko.computed(() => {
      const offerThroughput: number = this._getThroughput();
      if (
        offerThroughput < this.minThroughputRU() ||
        (offerThroughput > this.maxThroughputRU() && !this.canExceedMaximumValue())
      ) {
        return "";
      }

      const account = this.container.databaseAccount();
      if (!account) {
        return "";
      }

      const serverId: string = this.container.serverId();
      const regions =
        (account &&
          account.properties &&
          account.properties.readLocations &&
          account.properties.readLocations.length) ||
        1;
      const multimaster = (account && account.properties && account.properties.enableMultipleWriteLocations) || false;
      const rupmEnabled: boolean = this.rupm() === Constants.RUPMStates.on;

      let throughputSpendAckText: string;
      let estimatedSpend: string;
      if (!this.isSharedAutoPilotSelected()) {
        throughputSpendAckText = PricingUtils.getEstimatedSpendAcknowledgeString(
          offerThroughput,
          serverId,
          regions,
          multimaster,
          rupmEnabled,
          this.isSharedAutoPilotSelected()
        );
        estimatedSpend = PricingUtils.getEstimatedSpendHtml(
          offerThroughput,
          serverId,
          regions,
          multimaster,
          rupmEnabled
        );
      } else {
        throughputSpendAckText = PricingUtils.getEstimatedSpendAcknowledgeString(
          this.sharedAutoPilotThroughput(),
          serverId,
          regions,
          multimaster,
          rupmEnabled,
          this.isSharedAutoPilotSelected()
        );
        estimatedSpend = PricingUtils.getEstimatedAutoscaleSpendHtml(
          this.sharedAutoPilotThroughput(),
          serverId,
          regions,
          multimaster
        );
      }
      // TODO: change throughputSpendAckText to be a computed value, instead of having this side effect
      this.throughputSpendAckText(throughputSpendAckText);
      return estimatedSpend;
    });

    this.dedicatedRequestUnitsUsageCost = ko.computed(() => {
      const offerThroughput: number = this._getThroughput();
      if (
        offerThroughput < this.minThroughputRU() ||
        (offerThroughput > this.maxThroughputRU() && !this.canExceedMaximumValue())
      ) {
        return "";
      }

      const account = this.container.databaseAccount();
      if (!account) {
        return "";
      }

      const serverId: string = this.container.serverId();
      const regions =
        (account &&
          account.properties &&
          account.properties.readLocations &&
          account.properties.readLocations.length) ||
        1;
      const multimaster = (account && account.properties && account.properties.enableMultipleWriteLocations) || false;
      const rupmEnabled: boolean = this.rupm() === Constants.RUPMStates.on;

      let throughputSpendAckText: string;
      let estimatedSpend: string;
      if (!this.isAutoPilotSelected()) {
        throughputSpendAckText = PricingUtils.getEstimatedSpendAcknowledgeString(
          this.throughputMultiPartition(),
          serverId,
          regions,
          multimaster,
          rupmEnabled,
          this.isAutoPilotSelected()
        );
        estimatedSpend = PricingUtils.getEstimatedSpendHtml(
          this.throughputMultiPartition(),
          serverId,
          regions,
          multimaster,
          rupmEnabled
        );
      } else {
        throughputSpendAckText = PricingUtils.getEstimatedSpendAcknowledgeString(
          this.autoPilotThroughput(),
          serverId,
          regions,
          multimaster,
          rupmEnabled,
          this.isAutoPilotSelected()
        );
        estimatedSpend = PricingUtils.getEstimatedAutoscaleSpendHtml(
          this.autoPilotThroughput(),
          serverId,
          regions,
          multimaster
        );
      }
      // TODO: change throughputSpendAckText to be a computed value, instead of having this side effect
      this.throughputSpendAckText(throughputSpendAckText);
      return estimatedSpend;
    });

    this.isTryCosmosDBSubscription = ko.pureComputed<boolean>(() => {
      return (this.container && this.container.isTryCosmosDBSubscription()) || false;
    });

    this.isTryCosmosDBSubscription.subscribe((isTryCosmosDB: boolean) => {
      if (!!isTryCosmosDB) {
        this.resetData();
      }
    });

    this.canRequestSupport = ko.pureComputed(() => {
      if (
        !this.container.isEmulator &&
        !this.container.isTryCosmosDBSubscription() &&
        this.container.getPlatformType() !== PlatformType.Portal
      ) {
        const offerThroughput: number = this._getThroughput();
        return offerThroughput <= 100000;
      }

      return false;
    });

    this.costsVisible = ko.pureComputed(() => {
      return !this.container.isEmulator;
    });

    this.maxCollectionsReached = ko.computed<boolean>(() => {
      if (!this.isTryCosmosDBSubscription()) {
        return false;
      }

      const currentCollections = this.container
        .databases()
        .map((db: ViewModels.Database) => {
          if (db.collections() && "length" in db.collections()) {
            return db.collections().length;
          }

          return 0;
        })
        .reduce((totalCollections: number, collections: number) => {
          return totalCollections + collections;
        }, 0);

      const maxCollections = Constants.TryCosmosExperience.collectionsPerAccount;

      if (currentCollections >= maxCollections) {
        let typeOfContainer = "collection";
        if (this.container.isPreferredApiGraph() || this.container.isPreferredApiTable()) {
          typeOfContainer = "container";
        }

        this.maxCollectionsReachedMessage(
          `You cannot create more than ${maxCollections} ${typeOfContainer}(s) during the Try Cosmos DB trial period.`
        );
        return true;
      }

      return false;
    });

    this.storage.subscribe(() => {
      if (this.isFixedStorageSelected()) {
        this.isAutoPilotSelected(false);
        this.partitionKey("");
      }
      this._updateThroughputLimitByStorage();
    });

    // TODO: Create derived classes for Tables and Mongo to replace the If statements below
    this.partitionKeyName = ko.computed<string>(() => {
      if (this.container && !!this.container.isPreferredApiMongoDB()) {
        return "Shard key";
      }

      return "Partition key";
    });

    this.lowerCasePartitionKeyName = ko.computed<string>(() => this.partitionKeyName().toLowerCase());

    this.partitionKeyPlaceholder = ko.computed<string>(() => {
      if (this.container && !!this.container.isPreferredApiMongoDB()) {
        return "e.g., address.zipCode";
      }

      if (this.container && !!this.container.isPreferredApiGraph()) {
        return "e.g., /address";
      }

      return "e.g., /address/zipCode";
    });

    this.uniqueKeysPlaceholder = ko.pureComputed<string>(() => {
      if (this.container && !!this.container.isPreferredApiMongoDB()) {
        return "Comma separated paths e.g. firstName,address.zipCode";
      }

      return "Comma separated paths e.g. /firstName,/address/zipCode";
    });

    this.uniqueKeysVisible = ko.pureComputed<boolean>(() => {
      if (
        this.container == null ||
        !!this.container.isPreferredApiMongoDB() ||
        !!this.container.isPreferredApiTable() ||
        !!this.container.isPreferredApiCassandra() ||
        !!this.container.isPreferredApiGraph()
      ) {
        return false;
      }

      return true;
    });

    this.partitionKeyVisible = ko.computed<boolean>(() => {
      if (this.container == null || !!this.container.isPreferredApiTable()) {
        return false;
      }

      if (
        this.container.isPreferredApiMongoDB() &&
        !this.isUnlimitedStorageSelected() &&
        this.databaseHasSharedOffer()
      ) {
        return false;
      }

      if (!this.isUnlimitedStorageSelected() && !this.databaseHasSharedOffer()) {
        return false;
      }

      return true;
    });

    this.throughputSpendAckVisible = ko.pureComputed<boolean>(() => {
      const autoscaleThroughput = this.autoPilotThroughput() * 1;
      if (!this.hasAutoPilotV2FeatureFlag() && this.isAutoPilotSelected()) {
        return autoscaleThroughput > SharedConstants.CollectionCreation.DefaultCollectionRUs100K;
      }
      const selectedThroughput: number = this._getThroughput();
      const maxRU: number = this.maxThroughputRU && this.maxThroughputRU();

      const isMaxRUGreaterThanDefault: boolean = maxRU > SharedConstants.CollectionCreation.DefaultCollectionRUs100K;
      const isThroughputSetGreaterThanDefault: boolean =
        selectedThroughput > SharedConstants.CollectionCreation.DefaultCollectionRUs100K;

      if (this.canExceedMaximumValue()) {
        return isThroughputSetGreaterThanDefault;
      }

      return isThroughputSetGreaterThanDefault && isMaxRUGreaterThanDefault;
    });

    this.databaseCreateNew.subscribe((createNew: boolean) => {
      if (!createNew) {
        this.databaseCreateNewShared(this.getSharedThroughputDefault());
      }
    });

    this.databaseId.subscribe((selectedDatabaseId: string) => {
      if (!selectedDatabaseId) {
        return;
      }

      if (!this.databaseCreateNew()) {
        this.databaseHasSharedOffer(this._databaseOffers.has(selectedDatabaseId));
      }
    });

    this.databaseCreateNewShared.subscribe((useShared: boolean) => {
      this._updateThroughputLimitByStorage();
      this.databaseHasSharedOffer(useShared);
    });

    this.isAutoPilotSelected = ko.observable<boolean>(false);
    this.isSharedAutoPilotSelected = ko.observable<boolean>(false);
    this.selectedAutoPilotTier = ko.observable<DataModels.AutopilotTier>();
    this.selectedSharedAutoPilotTier = ko.observable<DataModels.AutopilotTier>();
    this.autoPilotTiersList = ko.observableArray<ViewModels.DropdownOption<DataModels.AutopilotTier>>(
      AutoPilotUtils.getAvailableAutoPilotTiersOptions()
    );
    this.sharedAutoPilotTiersList = ko.observableArray<ViewModels.DropdownOption<DataModels.AutopilotTier>>(
      AutoPilotUtils.getAvailableAutoPilotTiersOptions()
    );
    this.autoPilotThroughput = ko.observable<number>(AutoPilotUtils.minAutoPilotThroughput);
    this.sharedAutoPilotThroughput = ko.observable<number>(AutoPilotUtils.minAutoPilotThroughput);
    this.autoPilotUsageCost = ko.pureComputed<string>(() => {
      const autoPilot = this._getAutoPilot();
      if (!autoPilot) {
        return "";
      }
      const isDatabaseThroughput: boolean = this.databaseCreateNewShared();
      return !this.hasAutoPilotV2FeatureFlag()
        ? PricingUtils.getAutoPilotV3SpendHtml(autoPilot.maxThroughput, isDatabaseThroughput)
        : PricingUtils.getAutoPilotV2SpendHtml(autoPilot.autopilotTier, isDatabaseThroughput);
    });

    this.resetData();
    this.container.flight.subscribe(() => {
      this.resetData();
    });

    this.upsellMessage = ko.pureComputed<string>(() => {
      return PricingUtils.getUpsellMessage(this.container.serverId());
    });

    this.upsellMessageAriaLabel = ko.pureComputed<string>(() => {
      return `${this.upsellMessage()}. Click for more details`;
    });

    this.displayCollectionThroughput = ko.computed<boolean>(() => {
      const createNewDatabase = this.databaseCreateNew();
      const useExisitingDatabaseWithThroughput = !this.databaseCreateNew() && this.databaseHasSharedOffer();
      const useExisitingDatabaseWithoutThroughput = !this.databaseCreateNew() && !this.databaseHasSharedOffer();
      const provisionDatabaseThroughputIsChecked = this.databaseCreateNewShared();
      const provisionDedicatedThroughputForContainerIsChecked = this.collectionWithThroughputInShared();

      if (createNewDatabase && provisionDatabaseThroughputIsChecked) {
        return false;
      }

      if (createNewDatabase && !provisionDatabaseThroughputIsChecked) {
        return true;
      }

      if (useExisitingDatabaseWithThroughput && !provisionDedicatedThroughputForContainerIsChecked) {
        return false;
      }

      if (useExisitingDatabaseWithThroughput && provisionDedicatedThroughputForContainerIsChecked) {
        return true;
      }

      if (useExisitingDatabaseWithoutThroughput) {
        return true;
      }

      return false;
    });

    this.isFreeTierAccount = ko.computed<boolean>(() => {
      const databaseAccount = this.container && this.container.databaseAccount && this.container.databaseAccount();
      const isFreeTierAccount =
        databaseAccount && databaseAccount.properties && databaseAccount.properties.enableFreeTier;
      return isFreeTierAccount;
    });

    this.showIndexingOptionsForSharedThroughput = ko.computed<boolean>(() => {
      const newDatabaseWithSharedOffer = this.databaseCreateNew() && this.databaseCreateNewShared();
      const existingDatabaseWithSharedOffer = !this.databaseCreateNew() && this.databaseHasSharedOffer();

      if ((newDatabaseWithSharedOffer || existingDatabaseWithSharedOffer) && this.isFreeTierAccount()) {
        return true;
      }

      return false;
    });

    this.shouldUseDatabaseThroughput = ko.computed<boolean>(() => {
      // new database with shared offer
      if (this.databaseCreateNew() && this.databaseCreateNewShared()) {
        return true;
      }

      // existing database with shared offer and not provisioning collection level throughput
      if (!this.databaseCreateNew() && this.databaseHasSharedOffer() && !this.collectionWithThroughputInShared()) {
        return true;
      }

      return false;
    });

    this.isSynapseLinkSupported = ko.computed(() => {
      if (config.platform === Platform.Emulator) {
        return false;
      }
      if (this.container.isPreferredApiDocumentDB()) {
        return true;
      }

      if (this.container.isPreferredApiMongoDB() && this.container.hasStorageAnalyticsAfecFeature()) {
        return true;
      }

      if (this.container.isPreferredApiCassandra() && this.container.hasStorageAnalyticsAfecFeature()) {
        return true;
      }

      return false;
    });

    this._isSynapseLinkEnabled = ko.computed(() => {
      const databaseAccount =
        (this.container && this.container.databaseAccount && this.container.databaseAccount()) ||
        ({} as ViewModels.DatabaseAccount);
      const properties = databaseAccount.properties || ({} as DataModels.DatabaseAccountExtendedProperties);

      // TODO: remove check for capability once all accounts have been migrated
      const capabilities = properties.capabilities || ([] as DataModels.Capability[]);
      if (capabilities.some(capability => capability.name === Constants.CapabilityNames.EnableStorageAnalytics)) {
        return true;
      }

      const enableAnalyticalStorage: boolean = properties.enableAnalyticalStorage;
      if (enableAnalyticalStorage) {
        return true;
      }

      return false;
    });

    this.showEnableSynapseLink = ko.computed<boolean>(() => {
      return this.isSynapseLinkSupported() && !this._isSynapseLinkEnabled();
    });

    this.showAnalyticalStore = ko.computed(() => {
      return this.isSynapseLinkSupported() && this._isSynapseLinkEnabled();
    });

    this.isAnalyticalStorageOn = ko.observable<boolean>(this._isSynapseLinkEnabled());

    this._isSynapseLinkEnabled.subscribe((isSynapseLinkEnabled: boolean) => {
      this.isAnalyticalStorageOn(isSynapseLinkEnabled);
    });

    this.isSynapseLinkUpdating = ko.computed(() => this.container.isSynapseLinkUpdating());

    this.useIndexingForSharedThroughput.subscribe(value => {
      TelemetryProcessor.traceMark(Action.ModifyOptionForThroughputWithSharedDatabase, {
        changedSelectedValueTo: value ? ActionModifiers.IndexAll : ActionModifiers.NoIndex
      });
    });
  }

  public getSharedThroughputDefault(): boolean {
    const subscriptionType: ViewModels.SubscriptionType =
      this.container.subscriptionType && this.container.subscriptionType();

    if (subscriptionType === ViewModels.SubscriptionType.EA) {
      return false;
    }

    return true;
  }

  public onMoreDetailsKeyPress = (source: any, event: KeyboardEvent): boolean => {
    if (event.keyCode === Constants.KeyCodes.Space || event.keyCode === Constants.KeyCodes.Enter) {
      this.showErrorDetails();
      return false;
    }
    return true;
  };

  public open(databaseId?: string) {
    super.open();
    // TODO: Figure out if a database level partition split is about to happen once shared throughput read is available
    this.formWarnings("");
    this.databaseCreateNewShared(this.getSharedThroughputDefault());
    if (this.isPreferredApiTable() && !databaseId) {
      databaseId = SharedConstants.CollectionCreation.TablesAPIDefaultDatabase;
    }

    this.databaseCreateNew(!databaseId);
    this.collectionWithThroughputInShared(false);
    this.databaseId(databaseId);

    const addCollectionPaneOpenMessage = {
      databaseAccountName: this.container.databaseAccount().name,
      defaultExperience: this.container.defaultExperience(),
      collection: ko.toJS({
        id: this.collectionId(),
        storage: this.storage(),
        offerThroughput: this._getThroughput(),
        partitionKey: this.partitionKey(),
        databaseId: this.databaseId(),
        rupm: this.rupm()
      }),
      subscriptionType: ViewModels.SubscriptionType[this.container.subscriptionType()],
      subscriptionQuotaId: this.container.quotaId(),
      defaultsCheck: {
        storage: this.storage() === Constants.BackendDefaults.singlePartitionStorageInGb ? "f" : "u",
        throughput: this._getThroughput(),
        flight: this.container.flight()
      },
      dataExplorerArea: Constants.Areas.ContextualPane
    };

    this._onDatabasesChange(this.container.databases());
    this._setFocus();

    TelemetryProcessor.trace(Action.CreateCollection, ActionModifiers.Open, addCollectionPaneOpenMessage);
  }

  private _onDatabasesChange(newDatabaseIds: ViewModels.Database[]) {
    const cachedDatabaseIdsList = _.map(newDatabaseIds, (database: ViewModels.Database) => {
      if (database && database.offer && database.offer()) {
        this._databaseOffers.set(database.id(), database.offer());
      } else if (database && database.isDatabaseShared && database.isDatabaseShared()) {
        database.readSettings();
      }

      return database.id();
    });

    this.databaseIds(cachedDatabaseIdsList);
  }

  private _computeOfferThroughput(): number {
    if (this.databaseCreateNewShared()) {
      return this.isSharedAutoPilotSelected() ? undefined : this._getThroughput();
    }
    return this.isAutoPilotSelected() ? undefined : this._getThroughput();
  }

  public submit() {
    if (!this.isValid()) {
      return;
    }

    if (!!this.container.isPreferredApiTable()) {
      // Table require fixed Database: TablesDB, and fixed Partition Key: /'$pk'
      this.databaseId(SharedConstants.CollectionCreation.TablesAPIDefaultDatabase);
      this.partitionKey("/'$pk'");
    }

    let partitionKeyPath: string = this.partitionKey();
    const uniqueKeyPolicy: DataModels.UniqueKeyPolicy = this._getUniqueKeyPolicy();
    const offerThroughput: number = this._computeOfferThroughput();

    let partitionKeyVersion: number = this.largePartitionKey() ? 2 : undefined;
    let partitionKey: DataModels.PartitionKey = partitionKeyPath.trim()
      ? {
          paths: [partitionKeyPath],
          kind: Constants.BackendDefaults.partitionKeyKind,
          version: partitionKeyVersion
        }
      : null;
    const autoPilot: DataModels.AutoPilotCreationSettings = this._getAutoPilot();

    const addCollectionPaneStartMessage = {
      databaseAccountName: this.container.databaseAccount().name,
      defaultExperience: this.container.defaultExperience(),
      database: ko.toJS({
        id: this.databaseId(),
        new: this.databaseCreateNew(),
        shared: this.databaseHasSharedOffer()
      }),
      offerThroughput: offerThroughput,
      offerAutopilot: autoPilot,
      collection: ko.toJS({
        id: this.collectionId(),
        storage: this.storage(),
        partitionKey,
        rupm: this.rupm(),
        uniqueKeyPolicy,
        collectionWithThroughputInShared: this.collectionWithThroughputInShared()
      }),
      subscriptionType: ViewModels.SubscriptionType[this.container.subscriptionType()],
      subscriptionQuotaId: this.container.quotaId(),
      defaultsCheck: {
        storage: this.storage() === Constants.BackendDefaults.singlePartitionStorageInGb ? "f" : "u",
        throughput: offerThroughput,
        flight: this.container.flight()
      },
      dataExplorerArea: Constants.Areas.ContextualPane,
      useIndexingForSharedThroughput: this.useIndexingForSharedThroughput()
    };
    const startKey: number = TelemetryProcessor.traceStart(Action.CreateCollection, addCollectionPaneStartMessage);

    let databaseId: string = this.databaseCreateNew() ? this.databaseId().trim() : this.databaseId();
    let collectionId: string = this.collectionId().trim();
    let rupm: boolean = this.rupm() === Constants.RUPMStates.on;

    let indexingPolicy: DataModels.IndexingPolicy;
    // todo - remove mongo indexing policy ticket # 616274
    if (this.container.isPreferredApiMongoDB()) {
      indexingPolicy = SharedConstants.IndexingPolicies.Mongo;
    } else if (this.showIndexingOptionsForSharedThroughput()) {
      if (this.useIndexingForSharedThroughput()) {
        indexingPolicy = SharedConstants.IndexingPolicies.AllPropertiesIndexed;
      } else {
        indexingPolicy = SharedConstants.IndexingPolicies.SharedDatabaseDefault;
      }
    } else {
      indexingPolicy = SharedConstants.IndexingPolicies.AllPropertiesIndexed;
    }

    this.formErrors("");

    this.isExecuting(true);

    const createRequest: DataModels.CreateDatabaseAndCollectionRequest = {
      collectionId,
      databaseId,
      offerThroughput,
      databaseLevelThroughput: this.databaseHasSharedOffer() && !this.collectionWithThroughputInShared(),
      rupmEnabled: rupm,
      partitionKey,
      indexingPolicy,
      uniqueKeyPolicy,
      autoPilot,
      analyticalStorageTtl: this._getAnalyticalStorageTtl(),
      hasAutoPilotV2FeatureFlag: this.hasAutoPilotV2FeatureFlag()
    };

    const options: any = {};
    if (this.container.isPreferredApiMongoDB()) {
      options.initialHeaders = options.initialHeaders || {};
      options.initialHeaders[Constants.HttpHeaders.supportSpatialLegacyCoordinates] = true;
      options.initialHeaders[Constants.HttpHeaders.usePolygonsSmallerThanAHemisphere] = true;
    }

    const databaseCreateNew = this.databaseCreateNew();
    const useDatabaseSharedOffer = this.shouldUseDatabaseThroughput();
    const isSharded: boolean = !!partitionKeyPath;
    const autopilotSettings: DataModels.RpOptions = this._getAutopilotSettings();

    let createCollectionFunc: () => Q.Promise<DataModels.Collection | DataModels.CreateCollectionWithRpResponse>;

    if (this.container.isPreferredApiMongoDB()) {
      const isFixedCollectionWithSharedThroughputBeingCreated =
        this.container.isFixedCollectionWithSharedThroughputSupported() &&
        !this.isUnlimitedStorageSelected() &&
        this.databaseHasSharedOffer();
      const isAadUser = EnvironmentUtility.isAadUser();

      // note: v3 autopilot not supported yet for Mongo fixed collections (only tier supported)
      if (!isAadUser) {
        createCollectionFunc = () =>
          Q(
            createMongoCollectionWithProxy(
              databaseId,
              collectionId,
              offerThroughput,
              partitionKeyPath,
              databaseCreateNew,
              useDatabaseSharedOffer,
              isSharded,
              autopilotSettings
            )
          );
      } else {
        createCollectionFunc = () =>
          Q(
            createMongoCollectionWithARM(
              this.container.armEndpoint(),
              databaseId,
              this._getAnalyticalStorageTtl(),
              isFixedCollectionWithSharedThroughputBeingCreated,
              collectionId,
              offerThroughput,
              partitionKeyPath,
              databaseCreateNew,
              useDatabaseSharedOffer,
              isSharded,
              autopilotSettings
            )
          );
      }
    } else if (this.container.isPreferredApiTable() && EnvironmentUtility.isAadUser()) {
      createCollectionFunc = () =>
        Q(
          AddCollectionUtility.Utilities.createAzureTableWithARM(
            this.container.armEndpoint(),
            createRequest,
            autopilotSettings
          )
        );
    } else if (this.container.isPreferredApiGraph() && EnvironmentUtility.isAadUser()) {
      createCollectionFunc = () =>
        Q(
          AddCollectionUtility.CreateCollectionUtilities.createGremlinGraph(
            this.container.armEndpoint(),
            databaseId,
            collectionId,
            offerThroughput,
            partitionKeyPath,
            partitionKey.version,
            databaseCreateNew,
            useDatabaseSharedOffer,
            CosmosClient.subscriptionId(),
            CosmosClient.resourceGroup(),
            CosmosClient.databaseAccount().name,
            autopilotSettings
          )
        );
    } else if (this.container.isPreferredApiDocumentDB() && EnvironmentUtility.isAadUser()) {
      createCollectionFunc = () =>
        Q(
          AddCollectionUtility.CreateSqlCollectionUtilities.createSqlCollection(
            this.container.armEndpoint(),
            databaseId,
            this._getAnalyticalStorageTtl(),
            collectionId,
            offerThroughput,
            partitionKeyPath,
            partitionKey.version,
            databaseCreateNew,
            useDatabaseSharedOffer,
            CosmosClient.subscriptionId(),
            CosmosClient.resourceGroup(),
            CosmosClient.databaseAccount().name,
            uniqueKeyPolicy,
            autopilotSettings
          )
        );
    } else {
      createCollectionFunc = () =>
        this.container.documentClientUtility.getOrCreateDatabaseAndCollection(createRequest, options);
    }

    createCollectionFunc().then(
      () => {
        this.isExecuting(false);
        this.close();
        this.container.refreshAllDatabases();
        const addCollectionPaneSuccessMessage = {
          databaseAccountName: this.container.databaseAccount().name,
          defaultExperience: this.container.defaultExperience(),
          database: ko.toJS({
            id: this.databaseId(),
            new: this.databaseCreateNew(),
            shared: this.databaseHasSharedOffer()
          }),
          offerThroughput,
          collection: ko.toJS({
            id: this.collectionId(),
            storage: this.storage(),
            partitionKey,
            rupm: this.rupm(),
            uniqueKeyPolicy,
            collectionWithThroughputInShared: this.collectionWithThroughputInShared()
          }),
          subscriptionType: ViewModels.SubscriptionType[this.container.subscriptionType()],
          subscriptionQuotaId: this.container.quotaId(),
          defaultsCheck: {
            storage: this.storage() === Constants.BackendDefaults.singlePartitionStorageInGb ? "f" : "u",
            throughput: offerThroughput,
            flight: this.container.flight()
          },
          dataExplorerArea: Constants.Areas.ContextualPane
        };
        TelemetryProcessor.traceSuccess(Action.CreateCollection, addCollectionPaneSuccessMessage, startKey);
        this.resetData();
        return this.container.documentClientUtility.refreshCachedResources().then(() => {
          this.container.refreshAllDatabases();
        });
      },
      (reason: any) => {
        this.isExecuting(false);
        const message = ErrorParserUtility.parse(reason);
        const errorMessage = ErrorParserUtility.replaceKnownError(message[0].message);
        this.formErrors(errorMessage);
        this.formErrorsDetails(errorMessage);
        const addCollectionPaneFailedMessage = {
          databaseAccountName: this.container.databaseAccount().name,
          defaultExperience: this.container.defaultExperience(),
          database: ko.toJS({
            id: this.databaseId(),
            new: this.databaseCreateNew(),
            shared: this.databaseHasSharedOffer()
          }),
          offerThroughput: offerThroughput,
          collection: {
            id: this.collectionId(),
            storage: this.storage(),
            partitionKey,
            rupm: this.rupm(),
            uniqueKeyPolicy,
            collectionWithThroughputInShared: this.collectionWithThroughputInShared()
          },
          subscriptionType: ViewModels.SubscriptionType[this.container.subscriptionType()],
          subscriptionQuotaId: this.container.quotaId(),
          defaultsCheck: {
            storage: this.storage() === Constants.BackendDefaults.singlePartitionStorageInGb ? "f" : "u",
            throughput: offerThroughput,
            flight: this.container.flight()
          },
          dataExplorerArea: Constants.Areas.ContextualPane,
          error: reason
        };
        TelemetryProcessor.traceFailure(Action.CreateCollection, addCollectionPaneFailedMessage, startKey);
      }
    );
  }

  public resetData() {
    this.collectionId("");
    this.databaseId("");
    this.partitionKey("");
    this.throughputSpendAck(false);
    this.isAutoPilotSelected(false);
    this.isSharedAutoPilotSelected(false);
    if (!this.hasAutoPilotV2FeatureFlag()) {
      this.autoPilotThroughput(AutoPilotUtils.minAutoPilotThroughput);
      this.sharedAutoPilotThroughput(AutoPilotUtils.minAutoPilotThroughput);
    } else {
      this.selectedAutoPilotTier(undefined);
      this.selectedSharedAutoPilotTier(undefined);
    }
    this.uniqueKeys([]);
    this.useIndexingForSharedThroughput(true);

    const defaultStorage = this.container.collectionCreationDefaults.storage;
    this.storage(defaultStorage);

    const defaultThroughput = this.container.collectionCreationDefaults.throughput;
    this.throughputSinglePartition(defaultThroughput.fixed);
    this.throughputMultiPartition(
      AddCollectionUtility.Utilities.getMaxThroughput(this.container.collectionCreationDefaults, this.container)
    );

    this.throughputDatabase(defaultThroughput.shared);
    this.databaseCreateNew(true);
    this.databaseHasSharedOffer(this.getSharedThroughputDefault());
    this.collectionWithThroughputInShared(false);
    this.databaseCreateNewShared(this.getSharedThroughputDefault());
    if (this.isTryCosmosDBSubscription()) {
      this._resetDataForTryCosmosDB();
    }

    this.largePartitionKey(false);

    this._updateThroughputLimitByStorage();
    super.resetData();
  }

  public isNonTableApi = (): boolean => {
    return !this.container.isPreferredApiTable();
  };

  public isUnlimitedStorageSelected = (): boolean => {
    return this.storage() === Constants.BackendDefaults.multiPartitionStorageInGb;
  };

  public isFixedStorageSelected = (): boolean => {
    return this.storage() === Constants.BackendDefaults.singlePartitionStorageInGb;
  };

  public onStorageOptionsKeyDown(source: any, event: KeyboardEvent): boolean {
    if (event.keyCode === Constants.KeyCodes.RightArrow) {
      this.storage(Constants.BackendDefaults.multiPartitionStorageInGb);
      return false;
    }

    if (event.keyCode === Constants.KeyCodes.LeftArrow) {
      this.storage(Constants.BackendDefaults.singlePartitionStorageInGb);
      return false;
    }

    return true;
  }

  public onRupmOptionsKeyDown(source: any, event: KeyboardEvent): boolean {
    if (event.key === "ArrowRight") {
      this.rupm("off");
      return false;
    }

    if (event.key === "ArrowLeft") {
      this.rupm("on");
      return false;
    }

    return true;
  }

  public onEnableSynapseLinkButtonClicked() {
    this.container.openEnableSynapseLinkDialog();
  }

  public ttl90DaysEnabled: () => boolean = () => this.container.isFeatureEnabled(Constants.Features.ttl90Days);

  public isValid(): boolean {
    // TODO add feature flag that disables validation for customers with custom accounts
    if ((this.databaseCreateNewShared() && this.isSharedAutoPilotSelected()) || this.isAutoPilotSelected()) {
      const autoPilot = this._getAutoPilot();
      if (
        (!this.hasAutoPilotV2FeatureFlag() &&
          (!autoPilot ||
            !autoPilot.maxThroughput ||
            !AutoPilotUtils.isValidAutoPilotThroughput(autoPilot.maxThroughput))) ||
        (this.hasAutoPilotV2FeatureFlag() &&
          (!autoPilot || !autoPilot.autopilotTier || !AutoPilotUtils.isValidAutoPilotTier(autoPilot.autopilotTier)))
      ) {
        this.formErrors(
          !this.hasAutoPilotV2FeatureFlag()
            ? `Please enter a value greater than ${AutoPilotUtils.minAutoPilotThroughput} for autopilot throughput`
            : "Please select an Autopilot tier from the list."
        );
        return false;
      }
    }

    const throughput = this._getThroughput();
    const maxThroughputWithRUPM =
      SharedConstants.CollectionCreation.MaxRUPMPerPartition * this._calculateNumberOfPartitions();

    if (this.rupm() === Constants.RUPMStates.on && throughput > maxThroughputWithRUPM) {
      this.formErrors(
        `The maximum supported provisioned throughput with RU/m enabled is ${maxThroughputWithRUPM} RU/s. Please turn off RU/m to incease thoughput above ${maxThroughputWithRUPM} RU/s.`
      );
      return false;
    }

    if (throughput > SharedConstants.CollectionCreation.DefaultCollectionRUs100K && !this.throughputSpendAck()) {
      this.formErrors(`Please acknowledge the estimated daily spend.`);
      return false;
    }

    if (this.container.isPreferredApiGraph() && (this.partitionKey() === "/id" || this.partitionKey() === "/label")) {
      this.formErrors("/id and /label as partition keys are not allowed for graph.");
      return false;
    }

    const autoscaleThroughput = this.autoPilotThroughput() * 1;

    if (
      !this.hasAutoPilotV2FeatureFlag() &&
      this.isAutoPilotSelected() &&
      autoscaleThroughput > SharedConstants.CollectionCreation.DefaultCollectionRUs100K &&
      !this.throughputSpendAck()
    ) {
      this.formErrors(`Please acknowledge the estimated monthly spend.`);
      return false;
    }

    return true;
  }

  private _setFocus() {
    // Autofocus is enabled on AddCollectionPane based on the preferred API
    if (this.container.isPreferredApiTable()) {
      const focusTableId = document.getElementById("containerId");
      focusTableId && focusTableId.focus();
      return;
    }

    if (this.databaseCreateNew()) {
      const focusDatabaseId = document.getElementById("databaseId");
      focusDatabaseId && focusDatabaseId.focus();
      return;
    }

    const focusExistingDatabaseId = document.getElementById("containerId");
    focusExistingDatabaseId && focusExistingDatabaseId.focus();
  }

  private _getThroughput(): number {
    let throughput: number =
      this.storage() === Constants.BackendDefaults.singlePartitionStorageInGb
        ? this.throughputSinglePartition()
        : this.throughputMultiPartition();
    if (this.databaseHasSharedOffer()) {
      if (this.collectionWithThroughputInShared()) {
        throughput = this.throughputMultiPartition();
      } else {
        throughput = this.throughputDatabase();
      }
    }

    return isNaN(throughput) ? 0 : Number(throughput);
  }

  private _getAutoPilot(): DataModels.AutoPilotCreationSettings {
    if (
      (!this.hasAutoPilotV2FeatureFlag() &&
        this.databaseCreateNewShared() &&
        this.isSharedAutoPilotSelected() &&
        this.sharedAutoPilotThroughput()) ||
      (this.hasAutoPilotV2FeatureFlag() &&
        this.databaseCreateNewShared() &&
        this.isSharedAutoPilotSelected() &&
        this.selectedSharedAutoPilotTier())
    ) {
      return !this.hasAutoPilotV2FeatureFlag()
        ? {
            maxThroughput: this.sharedAutoPilotThroughput() * 1
          }
        : { autopilotTier: this.selectedSharedAutoPilotTier() };
    }
    if (
      (!this.hasAutoPilotV2FeatureFlag() && this.isAutoPilotSelected() && this.autoPilotThroughput()) ||
      (this.hasAutoPilotV2FeatureFlag() && this.isAutoPilotSelected() && this.selectedAutoPilotTier())
    ) {
      return !this.hasAutoPilotV2FeatureFlag()
        ? {
            maxThroughput: this.autoPilotThroughput() * 1
          }
        : { autopilotTier: this.selectedAutoPilotTier() };
    }

    return undefined;
  }
  private _getAutopilotSettings(): DataModels.RpOptions {
    if (
      (!this.hasAutoPilotV2FeatureFlag() &&
        this.databaseCreateNewShared() &&
        this.isSharedAutoPilotSelected() &&
        this.sharedAutoPilotThroughput()) ||
      (this.hasAutoPilotV2FeatureFlag() &&
        this.databaseCreateNewShared() &&
        this.isSharedAutoPilotSelected() &&
        this.selectedSharedAutoPilotTier())
    ) {
      return !this.hasAutoPilotV2FeatureFlag()
        ? {
            [Constants.HttpHeaders.autoPilotThroughput]: { maxThroughput: this.sharedAutoPilotThroughput() * 1 }
          }
        : { [Constants.HttpHeaders.autoPilotTier]: this.selectedSharedAutoPilotTier().toString() };
    }
    if (
      (!this.hasAutoPilotV2FeatureFlag() && this.isAutoPilotSelected() && this.autoPilotThroughput()) ||
      (this.hasAutoPilotV2FeatureFlag() && this.isAutoPilotSelected() && this.selectedAutoPilotTier())
    ) {
      return !this.hasAutoPilotV2FeatureFlag()
        ? {
            [Constants.HttpHeaders.autoPilotThroughput]: { maxThroughput: this.autoPilotThroughput() * 1 }
          }
        : { [Constants.HttpHeaders.autoPilotTier]: this.selectedAutoPilotTier().toString() };
    }
    return undefined;
  }

  private _calculateNumberOfPartitions(): number {
    // Note: this will not validate properly on accounts that have been set up for custom partitioning,
    // but there is no way to know the number of partitions for that case.
    return this.storage() === Constants.BackendDefaults.singlePartitionStorageInGb
      ? SharedConstants.CollectionCreation.NumberOfPartitionsInFixedCollection
      : SharedConstants.CollectionCreation.NumberOfPartitionsInUnlimitedCollection;
  }

  private _convertShardKeyToPartitionKey(
    shardKey: string,
    configurationOverrides: ViewModels.ConfigurationOverrides
  ): string {
    if (!shardKey) {
      return shardKey;
    }

    const shardKeyParts = shardKey.split(".");
    let partitionKey = shardKeyParts.join("/");

    if (partitionKey[0] !== "/") {
      partitionKey = "/" + partitionKey;
    }
    return partitionKey;
  }

  private _resetDataForTryCosmosDB() {
    this.storage(Constants.BackendDefaults.multiPartitionStorageInGb);
    this.throughputSinglePartition(Constants.TryCosmosExperience.defaultRU);
    this.throughputDatabase(SharedConstants.CollectionCreation.DefaultCollectionRUs400);
  }

  private _updateThroughputLimitByStorage() {
    if (this.databaseCreateNewShared()) {
      this._updateThroughputLimitByDatabase();
    } else {
      this._updateThroughputLimitByCollectionStorage();
    }
  }

  private _updateThroughputLimitByCollectionStorage() {
    const storage = this.storage();
    const minThroughputRU = AddCollectionUtility.Utilities.getMinRUForStorageOption(
      this.container.collectionCreationDefaults,
      storage
    );

    let maxThroughputRU = AddCollectionUtility.Utilities.getMaxRUForStorageOption(
      this.container.collectionCreationDefaults,
      storage
    );
    if (this.isTryCosmosDBSubscription()) {
      maxThroughputRU = Constants.TryCosmosExperience.maxRU;
    }

    this.minThroughputRU(minThroughputRU);
    this.maxThroughputRU(maxThroughputRU);
  }

  private _updateThroughputLimitByDatabase() {
    const defaultThruoghput = this.container.collectionCreationDefaults.throughput;
    this.maxThroughputRU(defaultThruoghput.unlimitedmax);
    this.minThroughputRU(defaultThruoghput.unlimitedmin);
  }

  /**
   * Obtains the UniqueKeyPolicy and applies transformations for Mongo APIs
   */
  private _getUniqueKeyPolicy(): DataModels.UniqueKeyPolicy {
    let transform = (value: string) => {
      return value;
    };
    if (this.container.isPreferredApiMongoDB()) {
      transform = (value: string) => {
        return this._convertShardKeyToPartitionKey(
          value,
          this.container.databaseAccount().properties.configurationOverrides
        );
      };
    }

    return this._parseUniqueIndexes(transform);
  }

  /**
   * Obtains the current added unique keys and applies cleaning, removing spaces and empty entries
   * @param transform Transformation process for each detected key
   */
  private _parseUniqueIndexes(transform: (value: string) => string): DataModels.UniqueKeyPolicy {
    if (this.uniqueKeys().length === 0) {
      return null;
    }

    const uniqueKeyPolicy: DataModels.UniqueKeyPolicy = { uniqueKeys: [] };
    this.uniqueKeys().forEach((uniqueIndexPaths: DynamicListItem) => {
      const uniqueIndexPathValue: string = uniqueIndexPaths.value();
      if (!!uniqueIndexPathValue && uniqueIndexPathValue.length > 0) {
        const validPaths: string[] = _.filter(
          uniqueIndexPathValue.split(","),
          (path: string) => !!path && path.length > 0
        );
        const cleanedUpPaths: string[] = validPaths.map((path: string) => {
          return transform(path.trim());
        });
        if (cleanedUpPaths.length > 0) {
          const uniqueKey: DataModels.UniqueKey = { paths: cleanedUpPaths };
          uniqueKeyPolicy.uniqueKeys.push(uniqueKey);
        }
      }
    });

    return uniqueKeyPolicy;
  }

  private _getAnalyticalStorageTtl(): number {
    if (!this.showAnalyticalStore()) {
      return undefined;
    }

    if (this.isAnalyticalStorageOn()) {
      // TODO: always default to 90 days once the backend hotfix is deployed
      return this.container.isFeatureEnabled(Constants.Features.ttl90Days)
        ? Constants.AnalyticalStorageTtl.Days90
        : Constants.AnalyticalStorageTtl.Infinite;
    }

    return Constants.AnalyticalStorageTtl.Disabled;
  }
}
