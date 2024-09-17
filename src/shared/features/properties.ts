import { i18n } from "src/plugin/translations/language";
import { FeatureRelation, FeatureSettingInfo, InsertedFeatureOptions, RelationType } from "./feature-options-base";

export class PropertiesOptions extends InsertedFeatureOptions
{
	hideProperties: string[];
	info_hideProperties = new FeatureSettingInfo(
	{
		show: true,
		description: i18n.settings.properties.info_hideProperties
	});

	constructor()
	{
		super();
		this.featureId = "properties";
		this.displayTitle = i18n.settings.properties.title;
		this.featurePlacement = new FeatureRelation(".header", RelationType.Start);
	}
}
