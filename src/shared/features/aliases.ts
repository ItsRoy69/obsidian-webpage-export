import {
	FeatureRelation,
	InsertedFeatureOptionsWithTitle,
	RelationType,
} from "./feature-options-base";

export class AliasesOptions extends InsertedFeatureOptionsWithTitle
{
	constructor()
	{
		super();
		this.featureId = "aliases";
		this.displayTitle = "";
		this.featurePlacement = new FeatureRelation(".header .data-bar", RelationType.Start);
	}
}
