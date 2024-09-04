import { useState, useEffect, useCallback, useRef } from 'react';
import { RadioButton, Icon, Flex, Box, Heading, Image, Input, Dropdown, Link, Button, ButtonRow, Table, Form, TableHead, TableHeader, TableCell, TableBody, TableRow, Text, Divider, EmptyState, LoadingSpinner, hubspot } from "@hubspot/ui-extensions";
import { CrmActionButton, CrmActionLink, CrmCardActions, CrmAssociationTable } from '@hubspot/ui-extensions/crm';

hubspot.extend(({ context, actions, runServerlessFunction }) => (
  <Extension context={context} actions={actions} runServerless={runServerlessFunction} />
));

const Extension = ({ context, actions, runServerless }) => {
  const [iframeUrl, setIframeUrl] = useState('');
  const [userrefreshtoken, setUserRefresh] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [apiKey, setAPIkey] = useState('');
  const [accessToken, setAccessToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [templateLink, setTemplateLink] = useState(null);
  const [authurl, setauth] = useState('');
  const [templates, setTemplates] = useState([]);
  const [fulltemplatelist, setfullTemplates] = useState([]);
  const [isIframeOpen, setIframeOpen] = useState(false);
  const [title, setTitle] = useState('Relevant Content');
  const [stageName, setStage] = useState('');
  const [propertiesToWatch, setpropertiesToWatch] = useState([]);
  const [objectType, setObjectType] = useState('');
  const [initialFilteredTemplates, setInitialFilteredTemplates] = useState([]);
  const [config, setConfig] = useState({});
  const [fieldsArray, setFieldsArray] = useState([]);
  const [filtersArray, setFiltersArray] = useState([]);
  const [projects, setProjects] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ field: null, direction: 'none' });
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [filteredTemplates, setFilteredTemplates] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [dataFetched, setDataFetched] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [lastModifiedDate, setLastModifiedDate] = useState('');
  const hasInitialized = useRef(false);
  const RECORDS_PER_PAGE = 10;
  const [hoveredRow, setHoveredRow] = useState(null);
  const [crmProperties, setCrmProperties] = useState({});

  let propertiesBody = {}; 
  let configData  = {};

  const fetchObjectType = async () => {
    try {
      const objectTypeResponse = await runServerless({
        name: 'objectType',
        parameters: { objectTypeId: context.crm.objectTypeId }
      });

      if (objectTypeResponse && objectTypeResponse.response && objectTypeResponse.response.body) {
        const objectTypeResponseBody = JSON.parse(objectTypeResponse.response.body);
        setObjectType(objectTypeResponseBody.objectType);
      } else {
        console.error("Error: Response body is undefined or not structured as expected.", objectTypeResponse);
      }
    } catch (error) {
      console.error("Error fetching object type:", error);
    }
  };

 
  const fetchPropertiesAndLoadConfig = async (objectType) => {
    try {
      setIsLoading(true);
  
      const userid = context.user.id;
  
      const createusertable = await runServerless({
        name: 'marqouathhandler',
        parameters: { userID: userid }
      });

      console.log('createusertable:', JSON.stringify(createusertable));
  
      if (createusertable?.response?.body) {
        const responseBody = JSON.parse(createusertable.response.body);
        const userData = responseBody.row?.values || {};  // Access values directly from row
    
        console.log('Parsed userData:', JSON.stringify(userData));

        let templateLink = userData.templatesfeed;
        let marquserid = userData.marqUserID;
        const currentRefreshToken = userData.refreshToken; 
        setUserRefresh(userData.refreshToken);
        

        console.log("Initial refresh token:", JSON.stringify(currentRefreshToken));
    
        if (!templateLink && currentRefreshToken) {
            console.log("Template link is null, fetching a new one...");
    
            const fetchResult = await runServerless({
                name: 'fetchTemplates',
                parameters: { 
                    userID: userid,
                    marquserid: marquserid,
                    refreshToken: currentRefreshToken 
                }
            });
    
            console.log('fetchResult:', JSON.stringify(fetchResult));
    
            if (fetchResult.statusCode === 200) {
                const fetchedData = JSON.parse(fetchResult.body);
                templateLink = fetchedData.templates_url;
                setUserRefresh(fetchedData.new_refresh_token);
                console.log("Refresh token after fetching templates:", JSON.stringify(userrefreshtoken));
                console.log("Fetched new refresh token:", fetchedData.new_refresh_token);

                console.log("Fetched new template link:", templateLink);
            } else {
                console.error("Failed to fetch new template link:", fetchResult.body);
            }
        }
    
        setTemplateLink(templateLink);
        console.log("Final Template Link:", JSON.stringify(templateLink));
        console.log("User table response:", JSON.stringify(userData));
    } else {
        console.error("Failed to create or fetch user table.");
        console.error('Unexpected structure in createusertable:', JSON.stringify(createusertable));
    }
    
  
      // Fetch config data
      const configDataResponse = await runServerless({
        name: 'hubdbHelper',
        parameters: { objectType }
      });
  
      if (configDataResponse?.response?.body) {
        configData = JSON.parse(configDataResponse.response.body).values || {};
        console.log("Config Data Loaded:", configData);
  
        // Set fieldsArray and filtersArray based on config
        const fields = configData.textboxFields?.split(',').map(field => field.trim()) || [];
        const filters = configData.textboxFilters?.split(',').map(filter => filter.trim()) || [];
  
        const propertiesToWatch = configData.textboxFields ? configData.textboxFields.split(',').map(field => field.trim()) : [];
        setpropertiesToWatch(propertiesToWatch);
        setFieldsArray(fields);
        setFiltersArray(filters);
  
        // Fetch CRM properties
        const designatedProperties = fields.filter(Boolean);
  
        console.log("objectType:", objectType);
        if (objectType === 'DEAL' && !designatedProperties.includes('dealstage')) {
          designatedProperties.push('dealstage');
        }
  
        if (designatedProperties.length > 0) {
          const propertiesResponse = await runServerless({
            name: 'getObjectProperties',
            parameters: { objectId: context.crm.objectId, objectType, properties: designatedProperties }
          });
  
          if (propertiesResponse?.response?.body) {
            propertiesBody = JSON.parse(propertiesResponse.response.body).mappedProperties || {};
            console.log("Fetched CRM Properties:", propertiesBody);
  
            if (objectType === 'DEAL') {
              const newstageName = propertiesBody.dealstage;
              setStage(newstageName);
            }
  
          } else {
            console.error("Failed to fetch properties:", propertiesResponse);
          }
        }
  
        // Fetch templates
        const templatesResponse = await runServerless({
          name: 'fetchJsonData',
          parameters: {
            templateLink: templateLink || ''
          }
        });
  
        if (templatesResponse?.response?.body) {
          const data = JSON.parse(templatesResponse.response.body);
          const fetchedTemplates = data.templatesresponse || [];
          setfullTemplates(fetchedTemplates);
          if (fields.length && filters.length && Object.keys(propertiesBody).length > 0) {
  
            const filtered = fetchedTemplates.filter(template => {
  
              return fields.every((field, index) => {
                const categoryName = filters[index];
                const propertyValue = propertiesBody[field]?.toLowerCase(); // Convert to lowercase
                const category = template.categories.find(c => c.category_name.toLowerCase() === categoryName.toLowerCase());
                if (category) {
                  const categoryValues = category.values.map(v => v.toLowerCase());
                  const matchFound = categoryValues.includes(propertyValue);
                  return matchFound;
                } else {
                  return false;
                }
              });
            });
            if (filtered.length === 0) {
              setFilteredTemplates(fetchedTemplates);
              setInitialFilteredTemplates(fetchedTemplates);
            } else {
              setInitialFilteredTemplates(filtered);
              setFilteredTemplates(filtered);
            }
          } else {
            console.warn("Fields or filters missing. Using unfiltered templates.");
            setTemplates(fetchedTemplates);
            setAllTemplates(fetchedTemplates);
            setFilteredTemplates(Array.isArray(fetchedTemplates) ? fetchedTemplates : []);
          }
        } else {
          console.error("Error: Response or response body is undefined.", templatesResponse);
        }
      } else {
        console.error("Failed to load config data:", configDataResponse);
      }
  
      setIsLoading(false);
    } catch (error) {
      console.error("Error in fetchConfigCrmPropertiesAndTemplates:", error);
      setIsLoading(false);
    }
  };
  



  const filterTemplates = (allTemplates, searchTerm, fieldsArray, filtersArray, properties) => {
    let filtered = Array.isArray(allTemplates) ? allTemplates : [];

    // Dynamically extract filters
    const categoryFilters = extractFiltersFromProperties(fieldsArray, filtersArray, properties);

    // Apply category filters with additional logic to include templates without certain filters
    filtered = filtered.filter(template =>
        categoryFilters.every(filter =>
            Array.isArray(template.categories) && template.categories.some(category =>
                (category.category_name === filter.name && category.values.includes(filter.value)) ||
                (category.category_name === filter.name && category.values.length === 0) // Include templates with no values for the category
            )
        )
    );

    // Apply search filter (searching within all templates)
    if (searchTerm) {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        filtered = filtered.filter(template =>
            template?.title?.toLowerCase().includes(lowerCaseSearchTerm)
        );
    }

    if (filtered.length === 0) {
      filtered = allTemplates; 
  }




    setFilteredTemplates(filtered);
    setTotalPages(Math.ceil(filtered.length / RECORDS_PER_PAGE));
    setCurrentPage(1); // Reset to first page
};

  





const deleteRecord = async (recordId, objectType) => {
  try {
    await runServerless({
      name: 'deleteRecord',
      parameters: { recordId, objectType }
    });

    // Remove the deleted record from the projects state
    setProjects((prevProjects) => prevProjects.filter(project => project.objectId !== recordId));
    
    // Add success alert
    actions.addAlert({
      title: "Success",
      message: "Project deleted successfully",
      variant: "success"
    });
  } catch (error) {
    console.error('Error deleting project:', error);
    
    // Add error alert
    actions.addAlert({
      title: "Error",
      variant: "error",
      message: `Failed to delete project: ${error.message}`,
    });
  }
};


  

  function formatDate(dateString) {
    const options = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short'
    };
    const date = new Date(dateString);
    return date.toLocaleString('en-US', options);
  }

  const fetchAssociatedProjectsAndDetails = useCallback(async (objectType) => {
    if (!context.crm.objectId) {
      console.error("No object ID available to fetch associated projects.");
      setIsLoading(false);
      return;
    }
  
    try {
      const associatedProjectsResponse = await runServerless({
        name: 'fetchProjects',
        parameters: {
          fromObjectId: context.crm.objectId,
          fromObjectType: objectType
        }
      });
  
      if (associatedProjectsResponse && associatedProjectsResponse.response && associatedProjectsResponse.response.body) {
        const projectsData = JSON.parse(associatedProjectsResponse.response.body);
        console.log("Fetched project data:", projectsData);
  
        if (projectsData && projectsData.results && projectsData.results.length > 0) {
          const uniqueProjectIds = new Set(projectsData.results.flatMap(p => p.to ? p.to.map(proj => proj.id) : []));
  
          const projectDetailsResponse = await runServerless({
            name: 'fetchProjectDetails',
            parameters: { objectIds: Array.from(uniqueProjectIds) }
          });
  
          if (projectDetailsResponse && projectDetailsResponse.response && projectDetailsResponse.response.body) {
            const projectDetails = JSON.parse(projectDetailsResponse.response.body);
            console.log("Fetched project details:", projectDetails);
  
            const uniqueDetailedProjects = new Map();
            projectsData.results.forEach(project => {
              project.to.forEach(p => {
                const detail = projectDetails.find(d => d.objectId === p.id);
                if (detail) {
                  uniqueDetailedProjects.set(p.id, { ...p, ...detail });
                } else {
                  uniqueDetailedProjects.set(p.id, p);
                }
              });
            });
  
            const detailedProjects = Array.from(uniqueDetailedProjects.values());
            detailedProjects.sort((a, b) => new Date(b.hs_lastmodifieddate) - new Date(a.hs_lastmodifieddate));
  
            console.log("Set project details:", detailedProjects);


            
            setProjects(detailedProjects);
            const totalPages = Math.ceil(detailedProjects.length / RECORDS_PER_PAGE);
            setTotalPages(totalPages);
            setIsLoading(false);
            setDataFetched(true);
          } else {
            console.error("Failed to fetch project details or empty response");
            setIsLoading(false);
            setDataFetched(true);
          }
        } else {
          console.error("Failed to fetch associated projects: Empty results array");
          setIsLoading(false);
          setDataFetched(true);
        }
      } else {
        throw new Error("Invalid or empty response from serverless function 'fetchProjects'.");
        setIsLoading(false);
        setDataFetched(true);
      }
    } catch (error) {
      console.error("Failed to fetch associated projects:", error);
      setIsLoading(false);
      setDataFetched(true);
      actions.addAlert({
        title: "API Error",
        variant: "error",
        message: `Error fetching associated projects: ${error.message || 'No error message available'}`
      });
    }
  }, [context.crm.objectId, runServerless, actions]);
  

  const editClick = async (projectId, fileId, encodedoptions) => {
    try {
      const userId = context.user.id;
      const contactId = context.crm.objectId;
  
      let editorinnerurl = `https://app.marq.com/documents/showIframedEditor/${projectId}/0?embeddedOptions=${encodedoptions}&creatorid=${userId}&contactid=${contactId}&apikey=${apiKey}&objecttype=${objectType}&fileid=${fileId}`;
      let editoriframeSrc = 'https://info.marq.com/marqembed?iframeUrl=' + encodeURIComponent(editorinnerurl);
  
      setIframeUrl(editoriframeSrc);
      actions.openIframeModal({
        uri: editoriframeSrc,
        height: 1500,
        width: 1500,
        title: "Marq Editor",
      });
      setIframeOpen(true);
    } catch (error) {
      console.error('Error in editClick:', error);
    }
  };
  

  const sendEmail = async (project) => {
    try {
      const response = await runServerlessFunction({
        name: 'generateEmailContent',
        parameters: { project }
      });
  
      if (response && response.emailContent) {
        const emailContent = response.emailContent;
        // Open the email composition window with the generated content
        actions.openEmailComposeWindow({
          to: project.contactEmail,
          subject: `Details for project ${project.name}`,
          body: emailContent
        });
      }
    } catch (error) {
      console.error('Failed to generate email content:', error);
    }
  };

  const extractFiltersFromProperties = (fieldsArray, filtersArray, properties) => {
    let filters = [];
    
    fieldsArray.forEach((field, index) => {
      if (properties[field]) {
        const fieldValue = properties[field];
        const filterValue = filtersArray[index];
        filters.push({ name: filterValue, value: fieldValue });
      }
    });

    console.log("Extracted Filters:", filters);

  
    return filters;
  };
  

  const handleOnSort = (fieldName, currentDirection) => {
    let newDirection = 'descending';
    if (currentDirection === 'ascending') {
      newDirection = 'descending';
    } else if (currentDirection === 'descending') {
      newDirection = 'none';
    } else {
      newDirection = 'ascending';
    }

    setSortConfig({ field: fieldName, direction: newDirection });

    const sortedProjects = [...projects];
    if (newDirection !== 'none') {
      sortedProjects.sort((a, b) => {
        if (a[fieldName] < b[fieldName]) {
          return newDirection === 'ascending' ? -1 : 1;
        }
        if (a[fieldName] > b[fieldName]) {
          return newDirection === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }

    setProjects(sortedProjects);
  };




  const refreshProjects = async () => {
    if (objectType) {
      setIsLoading(true);
      await fetchAssociatedProjectsAndDetails(objectType);
      setIsLoading(false);
    }
  };

  const setapi = async (userid, userEmail) => {
    try {
      const apiResponse = await runServerless({
        name: 'getApiKey'
      });
  
      if (apiResponse && apiResponse.response && apiResponse.response.body) {
        const body = JSON.parse(apiResponse.response.body);
        if (body && body.key) {
          const apiKey = body.key;
          setAPIkey(apiKey);
          console.log("API Key loaded:", apiKey);
          const authorizationUrl = handleConnectToMarq(apiKey, userid, userEmail);  // Pass the API key, userid, and userEmail
          setauth(authorizationUrl);
          return apiKey;  // Return the API key
        } else {
          console.error("No API key found in response.");
          actions.addAlert({
            title: "Error",
            variant: "error",
            message: "Failed to retrieve API key."
          });
        }
      } else {
        console.error("API response was invalid or missing.");
        actions.addAlert({
          title: "Error",
          variant: "error",
          message: "Invalid API response."
        });
      }
    } catch (error) {
      console.error("Error retrieving API key:", error);
      actions.addAlert({
        title: "Error",
        variant: "error",
        message: "Failed to retrieve API key."
      });
    }
    return null;  // Return null if the API key was not retrieved
  };

  // const setapi = async () => {
  //   try {
  //     const apiResponse = await runServerless({
  //       name: 'getApiKey'
  //     });
  
  //     if (apiResponse && apiResponse.response && apiResponse.response.body) {
  //       const body = JSON.parse(apiResponse.response.body);
  //       if (body && body.key) {
  //         const apiKey = body.key;
  //         setAPIkey(apiKey);
  //         console.log("API Key loaded:", apiKey);
  //         const authorizationUrl = handleConnectToMarq();
  //         setauth(authorizationUrl);
  //       } else {
  //         console.error("No API key found in response.");
  //         actions.addAlert({
  //           title: "Error",
  //           variant: "error",
  //           message: "Failed to retrieve API key."
  //         });
  //       }
  //     } else {
  //       console.error("API response was invalid or missing.");
  //       actions.addAlert({
  //         title: "Error",
  //         variant: "error",
  //         message: "Invalid API response."
  //       });
  //     }
  //   } catch (error) {
  //     console.error("Error retrieving API key:", error);
  //     actions.addAlert({
  //       title: "Error",
  //       variant: "error",
  //       message: "Failed to retrieve API key."
  //     });
  //   }
  // };

  const handleClick = async (template) => {
    try {
        const dynamicValue = (configData.value && context.crm.properties && configData.value in context.crm.properties)
            ? context.crm.properties[configData.value]
            : null;

        const userId = context.user.id;
        const contactId = context.crm.objectId;

        const enabledFeatures = configData.enabledFeatures?.map(feature => feature.name) || ["share"];
        const fileTypes = configData.fileTypes?.map(fileType => fileType.name) || ["pdf"];
        const showTabs = configData.showTabs?.map(tab => tab.name) || ["templates"];
        const configType = configData.configType?.name || "single";
        const dataSetType = configData.dataSetType?.name || "custom";
        const dataSetId = configData.dataSetId || `HB.${objectType}`;
        const key = configData.key || "id";

        const encodedOptions = encodeURIComponent(btoa(JSON.stringify({
            enabledFeatures,
            fileTypes,
            showTabs
        })));

        let importData = '';
        if (dataSetType === 'property listing') {
            importData = `propertyId=${dynamicValue || context.crm.objectId}`;
        } else if (dataSetType === 'custom') {
            importData = `dataSetId=${dataSetId}&key=${key}&value=${dynamicValue || context.crm.objectId}`;
        }

        const hasImportData = dataSetType !== 'none' && importData;

        // Fetch associated projects first
        const associatedProjectsResponse = await runServerless({
            name: 'fetchProjects',
            parameters: {
                fromObjectId: context.crm.objectId,
                fromObjectType: objectType
            }
        });

        if (associatedProjectsResponse && associatedProjectsResponse.response && associatedProjectsResponse.response.body) {
            const projectsData = JSON.parse(associatedProjectsResponse.response.body);
            console.log("Fetched project data:", projectsData);

            if (projectsData && projectsData.results && projectsData.results.length > 0) {
                const uniqueProjectIds = new Set(projectsData.results.flatMap(p => p.to ? p.to.map(proj => proj.id) : []));

                // Fetch project details using the unique project IDs
                const projectDetailsResponse = await runServerless({
                    name: 'fetchProjectDetails',
                    parameters: { objectIds: Array.from(uniqueProjectIds) }
                });

                if (projectDetailsResponse && projectDetailsResponse.response && projectDetailsResponse.response.body) {
                    const projectDetails = JSON.parse(projectDetailsResponse.response.body);
                    console.log("Fetched project details:", projectDetails);

                    const projectId = projectDetails[0].projectid; // Assuming the first result is the relevant one

                    // Now proceed with the iframe URL creation using projectId and other necessary details
                    let iframeSrc;
                    if (configType === "multiple") {
                        const returnUrl = `https://app.marq.com/documents/external?callback&${templateOptions}&embeddedOptions=${encodedOptions}`;
                        const baseInnerUrl = `https://app.marq.com/documents/iframe?returnUrl=${encodeURIComponent(returnUrl)}&creatorid=${userId}&contactid=${contactId}&apikey=${apiKey}&objecttype=${objectType}&projectid=${projectId}`;
                        const innerurl = hasImportData ? `${baseInnerUrl}&${importData}` : baseInnerUrl;
                        iframeSrc = 'https://info.marq.com/marqembed?iframeUrl=' + encodeURIComponent(innerurl) + '#/templates';
                    } else {
                        const baseInnerUrl = `https://app.marq.com/documents/editNewIframed/${template.id}?embeddedOptions=${encodedOptions}&creatorid=${userId}&contactid=${contactId}&apikey=${apiKey}&objecttype=${objectType}&dealstage=${stageName}&templateid=${template.id}&projectid=${projectId}`;
                        const innerurl = hasImportData ? `${baseInnerUrl}&${importData}` : baseInnerUrl;
                        iframeSrc = 'https://info.marq.com/marqembed?iframeUrl=' + encodeURIComponent(innerurl);
                    }

                    setIframeUrl(iframeSrc);
                    actions.openIframeModal({
                        uri: iframeSrc,
                        height: 1500,
                        width: 1500,
                        title: "Marq",
                    });
                    setIframeOpen(true);

                } else {
                    console.error("Failed to fetch project details or empty response");
                }
            } else {
                console.error("Failed to fetch associated projects: Empty results array");
            }
        } else {
            console.error("Failed to fetch associated projects.");
        }

    } catch (error) {
        console.error('Error in handleClick:', error);
        // Optionally, handle the error or provide feedback to the user
    }
};

  




  // const handleClick = async (template) => {
  //   try {
  //     const dynamicValue = (configData.value && context.crm.properties && configData.value in context.crm.properties)
  //       ? context.crm.properties[configData.value]
  //       : null;
  
  //     const userId = context.user.id;
  //     const contactId = context.crm.objectId;
  
  //     const enabledFeatures = configData.enabledFeatures?.map(feature => feature.name) || ["share"];
  //     const fileTypes = configData.fileTypes?.map(fileType => fileType.name) || ["pdf"];
  //     const showTabs = configData.showTabs?.map(tab => tab.name) || ["templates"];
  //     const configType = configData.configType?.name || "single";
  //     const dataSetType = configData.dataSetType?.name || "custom";
  //     const dataSetId = configData.dataSetId || `HB.${objectType}`;
  //     const key = configData.key || "id";
  
  //     const encodedOptions = encodeURIComponent(btoa(JSON.stringify({
  //       enabledFeatures,
  //       fileTypes,
  //       showTabs
  //     })));
  
  //     let importData = '';
  //     if (dataSetType === 'property listing') {
  //       importData = `propertyId=${dynamicValue || context.crm.objectId}`;
  //     } else if (dataSetType === 'custom') {
  //       importData = `dataSetId=${dataSetId}&key=${key}&value=${dynamicValue || context.crm.objectId}`;
  //     }
  
  //     const hasImportData = dataSetType !== 'none' && importData;
  
  //     // Prepare and format the category_filter
  //     let categoryFilter = configData.textboxFilters || '';
  //     categoryFilter = categoryFilter.replace(/%20/g, '+');
  //     console.log("categoryFilter:", categoryFilter);
  
  //     // Build templateOptions string dynamically
  //     const fieldsArray = configData.textboxFields?.split(',').map(field => field.trim()) || [];
  //     const filtersArray = configData.textboxFilters?.split(',').map(filter => filter.trim()) || [];
  
  //     if (fieldsArray.length !== filtersArray.length) {
  //       console.error("textboxFields and textboxFilters arrays length mismatch");
  //       return;
  //     }
  
  //     let filters = [];
  
  //     fieldsArray.forEach((field, index) => {
  //       try {
  //         if (context.crm.properties[field]) { // Check if the field exists in the properties
  //           const fieldValue = context.crm.properties[field];
  //           const formattedFilter = filtersArray[index].replace(/ /g, '+');
  //           const formattedValue = fieldValue.replace(/ /g, '+');
  //           filters.push(`${formattedFilter}%1E${formattedValue}`);
  
  //           if (index > 0) {
  //             filters.push(`${formattedFilter}%1EAll`);
  //           }
  //         } else {
  //           console.warn(`Property ${field} does not exist in the properties.`);
  //         }
  //       } catch (error) {
  //         console.error(`Error processing field ${field}:`, error);
  //       }
  //     });
  
  //     const templateOptions = `template_library=brand&category_filter=${filters.join('%1D')}`;
  //     console.log("templateOptions:", templateOptions);
  
  //     let iframeSrc;
  //     if (configType === "multiple") {
  //       const returnUrl = `https://app.marq.com/documents/external?callback&${templateOptions}&embeddedOptions=${encodedOptions}`;
  //       const baseInnerUrl = `https://app.marq.com/documents/iframe?returnUrl=${encodeURIComponent(returnUrl)}&creatorid=${userId}&contactid=${contactId}&apikey=${apiKey}&objecttype=${objectType}`;
  //       const innerurl = hasImportData ? `${baseInnerUrl}&${importData}` : baseInnerUrl;
  //       iframeSrc = 'https://info.marq.com/marqembed?iframeUrl=' + encodeURIComponent(innerurl) + '#/templates';
  //     } else {
  //       const baseInnerUrl = `https://app.marq.com/documents/editNewIframed/${template.id}?embeddedOptions=${encodedOptions}&creatorid=${userId}&contactid=${contactId}&apikey=${apiKey}&objecttype=${objectType}&dealstage=${stageName}&templateid=${template.id}`;
  //       const innerurl = hasImportData ? `${baseInnerUrl}&${importData}` : baseInnerUrl;
  //       iframeSrc = 'https://info.marq.com/marqembed?iframeUrl=' + encodeURIComponent(innerurl);
  //     }
  
  //     setIframeUrl(iframeSrc);
  //     actions.openIframeModal({
  //       uri: iframeSrc,
  //       height: 1500,
  //       width: 1500,
  //       title: "Marq",
  //     });
  //     setIframeOpen(true);
  //   } catch (error) {
  //     console.error('Error in handleClick:', error);
  //     // Optionally, handle the error or provide feedback to the user
  //   }
  // };
  
  

  useEffect(() => {
    fetchObjectType();
  }, [context.crm.objectTypeId, runServerless]);
  

  const handleSearch = useCallback((input) => {
    let searchValue = '';
    if (input && input.target) {
      searchValue = input.target.value;
    } else if (input) {
      searchValue = String(input);
    } else {
      console.error('Unexpected input:', input);
    }
  
    setSearchTerm(searchValue);
  
    if (searchValue.trim() === '') {
      setFilteredTemplates(initialFilteredTemplates); // Reset to initially filtered templates
      setTitle('Relevant Content');
    } else {
      setTitle('Search Results');
    }
  }, [initialFilteredTemplates]);
  
  useEffect(() => {
    if (searchTerm.trim() !== '') {
      const delayDebounceFn = setTimeout(() => {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();


        const searchResults = fulltemplatelist.filter(template =>
          template?.title?.toLowerCase().includes(lowerCaseSearchTerm)
        );
   
  
        // Combine search results with initially filtered templates
        setFilteredTemplates([...searchResults]);
        setCurrentPage(1); // Reset to first page on search
      }, 300);
  
      return () => clearTimeout(delayDebounceFn);
    }
  }, [searchTerm, templates, initialFilteredTemplates]);
  


useEffect(() => {
  const pages = Math.ceil(filteredTemplates.length / RECORDS_PER_PAGE);
  setTotalPages(pages);
}, [filteredTemplates]);
 

const handlePageChange = (pageNumber) => {
  if (pageNumber >= 1 && pageNumber <= totalPages) {
    setCurrentPage(pageNumber);
  }
};


const paginatedTemplates = filteredTemplates.slice(
  (currentPage - 1) * RECORDS_PER_PAGE,
  currentPage * RECORDS_PER_PAGE
);

const initialize = async () => {
  if (!hasInitialized.current && objectType) {
    hasInitialized.current = true;

    fetchPropertiesAndLoadConfig(objectType);
    fetchAssociatedProjectsAndDetails(objectType);

    // Fetch the userid and userEmail from context
    const userid = context.user.id;
    const userEmail = context.user.email; // Assuming context provides the user's email here

    // Fetch the API key and pass the userid and userEmail
    const apiKey = await setapi(userid, userEmail);
    setAPIkey(apiKey);

    // Fetch Marq user data and update refresh token if necessary
    const createusertable = await runServerless({
      name: 'marqouathhandler',
      parameters: { userID: userid }
    });

    if (createusertable?.response?.body) {
      const userData = JSON.parse(createusertable.response.body).values || {};
      setUserRefresh(userData.refreshToken);
      console.log("User table response:", userData);
    } else {
      console.error("Failed to create or fetch user table.");
    }

  } else if (
    hasInitialized.current &&
    fieldsArray.length > 0 &&
    filtersArray.length > 0 &&
    Object.keys(crmProperties).length > 0
  ) {
    filterTemplates(fulltemplatelist, searchTerm, fieldsArray, filtersArray, crmProperties);
  }
};

// const initialize = async () => {
//   if (!hasInitialized.current && objectType) {
//     hasInitialized.current = true;

//     fetchPropertiesAndLoadConfig(objectType);
//     fetchAssociatedProjectsAndDetails(objectType);

//     // Fetch the userid and userEmail from context
//     const userid = context.user.id;
//     const userEmail = context.user.email; // Assuming context provides the user's email here

//     // Fetch the API key and pass the userid and userEmail
//     const apiKey = await setapi(userid, userEmail);
//     setAPIkey(apiKey);

//   } else if (
//     hasInitialized.current &&
//     fieldsArray.length > 0 &&
//     filtersArray.length > 0 &&
//     Object.keys(crmProperties).length > 0
//   ) {
//     filterTemplates(fulltemplatelist, searchTerm, fieldsArray, filtersArray, crmProperties);
//   }
// };

useEffect(() => {
  fetchObjectType();
}, [context.crm.objectTypeId, runServerless]);

useEffect(() => {
  initialize();
}, [
  apiKey,
  accessToken,
  userrefreshtoken,
  context.crm.objectId,
  context.crm.objectTypeId,
  objectType,
  fieldsArray,
  filtersArray,
  crmProperties,
  fulltemplatelist,
  searchTerm
]);

useEffect(() => {
  try {
    if (userrefreshtoken) {
      console.log("Refresh token updated:", userrefreshtoken);
    }
  } catch (error) {
    console.error("Error in useEffect:", error);
  }
}, [userrefreshtoken]);



useEffect(() => {
    const handlePropertiesUpdate = (properties) => {
        if (!fieldsArray || fieldsArray.length === 0) {
            console.warn('fieldsArray is empty or undefined:', fieldsArray);
            return;
        }

        const hasRelevantChange = fieldsArray.some(field => properties[field]);

        if (hasRelevantChange) {
            if (context.crm.objectId && context.crm.objectTypeId) {
                fetchPropertiesAndLoadConfig(objectType);

                if (hasInitialized.current && filtersArray.length > 0 && Object.keys(crmProperties).length > 0) {
                    filterTemplates(fulltemplatelist, searchTerm, fieldsArray, filtersArray, crmProperties);
                }
            } 
        } 
    };

    if (fieldsArray && fieldsArray.length > 0) {
        actions.onCrmPropertiesUpdate(fieldsArray, handlePropertiesUpdate);
    } else {
        console.warn('fieldsArray is empty, no properties to watch.');
    }

    return () => {
        actions.onCrmPropertiesUpdate([], null);
    };
}, [context.crm.objectId, context.crm.objectTypeId, objectType, fieldsArray, filtersArray, crmProperties, fulltemplatelist, searchTerm]);


// useEffect(() => {
//   window.updateTokens = (newAccessToken, newRefreshToken) => {
//       setAccessToken(newAccessToken);
//       setRefreshToken(newRefreshToken);
//   };
// }, []);

//   useEffect(() => {
//     const initialize = async () => {
//       if (!hasInitialized.current && objectType) {
//         hasInitialized.current = true;
//         const apiKey = await setapi();  // Wait for setapi() to complete
//         console.log(`This is the API Key: ${apiKey}`);  // Log the API Key
//         fetchPropertiesAndLoadConfig(objectType);
//         fetchAssociatedProjectsAndDetails(objectType);
//       } else if (
//         hasInitialized.current &&
//         fieldsArray.length > 0 &&
//         filtersArray.length > 0 &&
//         Object.keys(crmProperties).length > 0
//       ) {
//         filterTemplates(fulltemplatelist, searchTerm, fieldsArray, filtersArray, crmProperties);
//       }
//     };
  
//     initialize();  // Call the async function
//   }, [
//     context.crm.objectId,
//     context.crm.objectTypeId,
//     objectType,
//     fieldsArray,
//     filtersArray,
//     crmProperties,
//     fulltemplatelist,
//     searchTerm
//   ]);

//   useEffect(() => {
//     const handlePropertiesUpdate = (properties) => {
//         if (!fieldsArray || fieldsArray.length === 0) {
//             console.warn('fieldsArray is empty or undefined:', fieldsArray);
//             return;
//         }

  

//         // Checking for relevant property changes
//         const hasRelevantChange = fieldsArray.some(field => properties[field]);

//         if (hasRelevantChange) {
//             if (context.crm.objectId && context.crm.objectTypeId) {
//                 fetchPropertiesAndLoadConfig(objectType);

//                 if (hasInitialized.current && filtersArray.length > 0 && Object.keys(crmProperties).length > 0) {
//                     filterTemplates(fulltemplatelist, searchTerm, fieldsArray, filtersArray, crmProperties);
//                 }
//             } else {
//             }
//         } else {
//         }
//     };

//     if (fieldsArray && fieldsArray.length > 0) {
//         actions.onCrmPropertiesUpdate(fieldsArray, handlePropertiesUpdate);
//     } else {
//         console.warn('fieldsArray is empty, no properties to watch.');
//     }

//     return () => {
//         actions.onCrmPropertiesUpdate([], null);
//     };
// }, [context.crm.objectId, context.crm.objectTypeId, objectType, fieldsArray, filtersArray, crmProperties, fulltemplatelist, searchTerm]);

{/* <Flex direction="row" align="start" gap="medium">
<Image
  alt="Marq logo"
  src={`https://cdn-cashy-static-assets.marq.com/app/webroot/img/logos/marq/MarqLogo183x50.svg`}
  preventDefault={true}
  width={100}
/>
</Flex> */}

{/* <Flex direction="column" align="start" gap="medium">
<Box flex={1}>
<Image
             alt="Marq logo"
             src={`https://cdn-cashy-static-assets.marq.com/app/webroot/img/logos/marq/MarqLogo183x50.svg`}
             preventDefault={true}
             width={100}
           />
           </Box>
           <Box>

           </Box>
</Flex> */}


const handleConnectToMarq = (apiKey, userid, userEmail) => {
  try {
    const metadataType = 'user'; // Customize this as needed
    const authorizationUrl = getAuthorizationUrl(metadataType, apiKey, userid, userEmail);  // Pass userid and userEmail

    if (!authorizationUrl) {
      throw new Error('Failed to generate authorization URL.');
    }

    return authorizationUrl; // Return the URL to be used in the href
  } catch (error) {
    console.error('Error during authorization process:', error.message);
    // You can handle errors here, but avoid using alert since it's not supported.
  }
};



function getAuthorizationUrl(metadataType, apiKey, userid, userEmail) {
  try {
    const clientId = 'wfcWQOnE4lEpKqjjML2IEHsxUqClm6JCij6QEXGa';
    const clientSecret = 'YiO9bZG7k1SY-TImMZQUsEmR8mISUdww2a1nBuAIWDC3PQIOgQ9Q44xM16x2tGd_cAQGtrtGx4e7sKJ0NFVX';
    const redirectUri = 'https://info.marq.com/crm-oauth-hubspot';

    const encodedRedirectUri = encodeURIComponent(redirectUri);

    // Create the state map that includes the API key, userId, email, and other details
    const stateMap = {
      apiKey: apiKey,
      metadataType: metadataType,
      clientId: clientId,
      clientSecret: clientSecret,
      redirectUri: encodedRedirectUri,
      userid: userid,       // Include the userId here
      email: userEmail      // Include the userEmail here
    };

    const stateJson = JSON.stringify(stateMap);
    const stateParam = btoa(stateJson); // Encode the state parameter

    let scopes;
    let authorizationUrl;

    // Determine the correct scopes and URL based on the metadata type
    if (metadataType.toLowerCase() === 'data') {
      scopes = 'project.templates project.content data-service.admin offline_access';
    } else {
      scopes = 'project.templates project.content offline_access';
    }

    const encodedScopes = encodeURIComponent(scopes);

    // Construct the authorization URL
    authorizationUrl = `https://app.marq.com/oauth2/authorize`
                     + `?response_type=code`
                     + `&client_id=${clientId}`
                     + `&client_secret=${clientSecret}`
                     + `&scope=${encodedScopes}`
                     + `&redirect_uri=${encodedRedirectUri}`
                     + `&state=${stateParam}`;

    return authorizationUrl;

  } catch (error) {
    console.error('Error generating authorization URL:', error.message);
    return null;
  }
}



if (iframeLoading || isLoading) {
  return (
    <Flex direction="column" gap="medium" align="center">
      <LoadingSpinner label="Loading projects..." layout="centered" />
    </Flex>
  );
}

if (!userrefreshtoken) {
  return (
    <Button
      href={authurl}
      variant="primary"
      size="med"
      type="button"
    >
      Connect to Marq
    </Button>
  );
}

return (
  <>
    <Form>
      <Flex direction="row" justify="center" gap="small">
        <Box flex={1}>
          <Input
            type="text"
            placeholder="⌕ Search all templates"
            value={searchTerm}
            onInput={handleSearch}
            style={{ width: '100%' }}
          />
        </Box>
      </Flex>

      <Divider />

      <Flex direction="column" align="start" gap="small">
        <Box />
        <Box>
          <Text format={{ fontWeight: 'bold' }}>{title}</Text>
        </Box>
      </Flex>
    </Form>

    <Table
      paginated
      page={currentPage}
      pageCount={totalPages}
      maxVisiblePageButtons={5}
      showButtonLabels
      showFirstLastButtons={false}
      onPageChange={handlePageChange}
    >
      <TableBody>
        {paginatedTemplates.map((template, index) => {
          const matchingProject = projects.find(
            project => project.originaltemplateid === template.id
          );

          return matchingProject ? (
            <TableRow key={matchingProject.objectId || index}>
              <TableCell>
                <Image
                  alt="File Preview"
                  src={`https://app.marq.com/documents/thumb/${matchingProject.projectid}/0/2048/NULL/400`}
                  onClick={() => editClick(matchingProject.projectid, matchingProject.fileid, matchingProject.encodedoptions)}
                  preventDefault
                  width={100}
                />
              </TableCell>
              <TableCell>
                <Link
                  href="#"
                  onClick={() => editClick(matchingProject.projectid, matchingProject.fileid, matchingProject.encodedoptions)}
                  preventDefault
                  variant="primary"
                >
                  {matchingProject.name}
                </Link>
              </TableCell>
              <TableCell>{formatDate(matchingProject.hs_lastmodifieddate)}</TableCell>
              <TableCell>
                <ButtonRow disableDropdown={false}>
                  <Button onClick={() => editClick(matchingProject.projectid, matchingProject.fileid, matchingProject.encodedoptions)}>
                    Open
                  </Button>
                  <CrmActionButton actionType="EXTERNAL_URL" actionContext={{ href: matchingProject.fileurl }} variant="secondary">
                    Copy Published URL
                  </CrmActionButton>
                  <CrmActionButton
                    actionType="SEND_EMAIL"
                    actionContext={{
                      objectTypeId: context.crm.objectTypeId,
                      objectId: context.crm.objectId,
                    }}
                    variant="secondary"
                  >
                    Send email
                  </CrmActionButton>
                  <Button variant="destructive" onClick={() => deleteRecord(matchingProject.objectId, 'projects')}>
                    Delete
                  </Button>
                </ButtonRow>
              </TableCell>
            </TableRow>
          ) : (
            <TableRow key={template.id || index} onClick={() => setSelectedRow(selectedRow === index ? null : index)}>
              <TableCell>
                <Image
                  alt="Template Preview"
                  src={`https://app.marq.com/documents/thumb/${template.id}/0/2048/NULL/400`}
                  onClick={() => handleClick(template)}
                  preventDefault
                  width={100}
                />
              </TableCell>
              <TableCell>
                <Link
                  href="#"
                  onClick={() => handleClick(template)}
                  preventDefault
                  variant="primary"
                >
                  {template.title}
                </Link>
              </TableCell>
              <TableCell />
              <TableCell>
                <Button onClick={() => handleClick(template)}>Create with Marq</Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  </>
);

};

export default Extension;